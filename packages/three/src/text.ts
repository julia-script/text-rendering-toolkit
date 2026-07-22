import type { LayoutBounds, LayoutResult, PositionedGlyph } from '@webgpu-text/layout'
import type { SdfViewBox } from '@webgpu-text/sdf'
import { Color, type ColorRepresentation, Mesh } from 'three/webgpu'

import { DisposedTextError, InvalidTextInputError } from './errors.js'
import {
  createGlyphGeometry,
  createGlyphMaterial,
  type GlyphInstanceData,
  type GlyphMaterialControls,
  updateGlyphGeometry,
  updateGlyphMaterial,
} from './rendering.js'
import {
  commitTextResources,
  planTextResources,
  type TextResourcePlan,
  TextResources,
  textResourceBinding,
} from './resources.js'
import type { TextFont, TextMaterial, TextOptions } from './types.js'

const DEFAULT_COLOR = 0xffffff

interface SyncSnapshot {
  readonly revision: number
  readonly layout: LayoutResult
  readonly fonts: ReadonlyMap<string, TextFont>
  readonly color: ColorRepresentation
  readonly styleColors: Readonly<Record<string, ColorRepresentation>>
  readonly opacity: number
  readonly clipRect: LayoutBounds | null
}

interface BuiltState {
  readonly layout: LayoutResult
  readonly resources: TextResourcePlan
  readonly instances: GlyphInstanceData
  readonly opacity: number
  readonly clipRect: LayoutBounds | null
}

function invalid(message: string, cause?: unknown): InvalidTextInputError {
  return new InvalidTextInputError(message, cause === undefined ? undefined : { cause })
}

function validateOpacity(opacity: number): void {
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
    throw invalid('opacity must be finite and from 0 through 1')
  }
}

function validateClipRect(bounds: LayoutBounds | null): void {
  if (bounds === null) return
  const values = [bounds.left, bounds.bottom, bounds.right, bounds.top]
  if (!values.every(Number.isFinite) || bounds.left > bounds.right || bounds.bottom > bounds.top) {
    throw invalid('clipRect must contain finite non-inverted bounds')
  }
}

function validateLayout(layout: LayoutResult): void {
  if (!layout || typeof layout !== 'object' || !Array.isArray(layout.glyphs)) {
    throw invalid('layout must be a completed LayoutResult')
  }
  const bounds = layout.blockBounds
  if (!bounds || typeof bounds !== 'object') {
    throw invalid('layout.blockBounds must contain finite non-inverted bounds')
  }
  const boundValues = [bounds.left, bounds.bottom, bounds.right, bounds.top]
  if (
    !boundValues.every(Number.isFinite) ||
    bounds.left > bounds.right ||
    bounds.bottom > bounds.top
  ) {
    throw invalid('layout.blockBounds must contain finite non-inverted bounds')
  }
  for (const [index, glyph] of layout.glyphs.entries()) {
    if (!glyph || typeof glyph !== 'object') {
      throw invalid(`layout.glyphs[${index}] must be a positioned glyph`)
    }
    if (
      !glyph.fontKey ||
      !glyph.styleKey ||
      !Number.isSafeInteger(glyph.glyphId) ||
      glyph.glyphId < 0
    ) {
      throw invalid(`layout.glyphs[${index}] has invalid identity data`)
    }
    if (!Number.isFinite(glyph.fontUnitScale) || glyph.fontUnitScale <= 0) {
      throw invalid(`layout.glyphs[${index}].fontUnitScale must be finite and positive`)
    }
    for (const key of ['x', 'y', 'xOffset', 'yOffset'] as const) {
      if (!Number.isFinite(glyph[key])) {
        throw invalid(`layout.glyphs[${index}].${key} must be finite`)
      }
    }
    for (const [axis, value] of Object.entries(glyph.variations)) {
      if (!axis || !Number.isFinite(value)) {
        throw invalid(`layout.glyphs[${index}].variations is invalid`)
      }
    }
  }
}

function normalizedColor(value: ColorRepresentation, label: string): Color {
  try {
    const color = new Color(value)
    if (![color.r, color.g, color.b].every(Number.isFinite)) throw new Error('non-finite color')
    return color
  } catch (error) {
    throw invalid(`${label} is not a valid finite Three.js color`, error)
  }
}

function quadBounds(
  glyph: PositionedGlyph,
  viewBox: SdfViewBox,
  scale: number,
): readonly [number, number, number, number] {
  const originX = glyph.x + glyph.xOffset
  const originY = glyph.y + glyph.yOffset
  return [
    originX + viewBox.left * scale,
    originY + viewBox.bottom * scale,
    originX + viewBox.right * scale,
    originY + viewBox.top * scale,
  ]
}

export class Text extends Mesh<ReturnType<typeof createGlyphGeometry>, TextMaterial> {
  layout: LayoutResult
  fonts: ReadonlyMap<string, TextFont>
  color: ColorRepresentation
  styleColors: Readonly<Record<string, ColorRepresentation>>
  opacity: number
  clipRect: LayoutBounds | null
  readonly lit: boolean
  readonly sdfSize: number

  readonly #resources: TextResources
  readonly #ownsResources: boolean
  readonly #controls: GlyphMaterialControls
  #revision = 0
  #pending: Promise<void> | null = null
  #latest: SyncSnapshot | null = null
  #layoutResult: LayoutResult | null = null
  #disposed = false

  constructor(options: TextOptions) {
    if (options.resources !== undefined && options.sdfSize !== undefined) {
      throw invalid('resources and sdfSize cannot be supplied together')
    }
    if (options.resources !== undefined && !(options.resources instanceof TextResources)) {
      throw invalid('resources must be a TextResources instance')
    }
    const lit = options.lit ?? false
    if (typeof lit !== 'boolean') throw invalid('lit must be a boolean')
    const ownsResources = options.resources === undefined
    const resources =
      options.resources ??
      (options.sdfSize === undefined
        ? new TextResources()
        : new TextResources({ sdfSize: options.sdfSize }))
    const binding = textResourceBinding(resources)
    const geometry = createGlyphGeometry()
    const rendered = createGlyphMaterial(binding.texture, binding.atlasGrid, lit)
    super(geometry, rendered.material)
    this.layout = options.layout
    this.fonts = options.fonts
    this.color = options.color ?? DEFAULT_COLOR
    this.styleColors = options.styleColors ?? {}
    this.opacity = options.opacity ?? 1
    this.clipRect = options.clipRect ?? null
    this.lit = lit
    this.sdfSize = resources.sdfSize
    this.#resources = resources
    this.#ownsResources = ownsResources
    this.#controls = rendered.controls
    this.frustumCulled = false
  }

  get layoutResult(): LayoutResult | null {
    return this.#layoutResult
  }

  get committedState(): {
    readonly layoutResult: LayoutResult
    readonly instanceCount: number
  } | null {
    return this.#layoutResult
      ? { layoutResult: this.#layoutResult, instanceCount: this.geometry.instanceCount }
      : null
  }

  sync(): Promise<void> {
    if (this.#disposed) return Promise.reject(new DisposedTextError())
    const revision = ++this.#revision
    this.#latest = {
      revision,
      layout: this.layout,
      fonts: new Map(this.fonts),
      color: this.color,
      styleColors: { ...this.styleColors },
      opacity: this.opacity,
      clipRect: this.clipRect ? { ...this.clipRect } : null,
    }
    this.#pending ??= Promise.resolve().then(() => this.#flush())
    return this.#pending
  }

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    this.#revision += 1
    this.#latest = null
    this.#layoutResult = null
    this.geometry.dispose()
    this.material.dispose()
    if (this.#ownsResources) this.#resources.dispose()
  }

  async #flush(): Promise<void> {
    try {
      const snapshot = this.#latest
      if (this.#disposed || !snapshot) throw new DisposedTextError()
      const built = this.#build(snapshot)
      if (this.#disposed || snapshot.revision !== this.#revision) throw new DisposedTextError()
      updateGlyphGeometry(this.geometry, built.instances, built.layout.blockBounds)
      commitTextResources(this.#resources, built.resources)
      updateGlyphMaterial(this.#controls, built.opacity, built.clipRect)
      this.#layoutResult = built.layout
    } finally {
      this.#latest = null
      this.#pending = null
    }
  }

  #build(snapshot: SyncSnapshot): BuiltState {
    validateOpacity(snapshot.opacity)
    validateClipRect(snapshot.clipRect)
    const defaultColor = normalizedColor(snapshot.color, 'color')
    const styleColors = new Map<string, Color>()
    for (const [key, value] of Object.entries(snapshot.styleColors)) {
      styleColors.set(key, normalizedColor(value, `styleColors.${key}`))
    }
    const layout = snapshot.layout
    validateLayout(layout)
    const resources = planTextResources(this.#resources, layout.glyphs, snapshot.fonts)
    const renderable = resources.glyphs
    const bounds = new Float32Array(renderable.length * 4)
    const slots = new Uint32Array(renderable.length)
    const colors = new Uint8Array(renderable.length * 3)
    for (const [index, item] of renderable.entries()) {
      const cached = resources.atlas.glyphs.get(item.key)
      if (!cached || cached.slot === null || !cached.viewBox) {
        throw invalid(`Atlas plan is missing glyph ${item.glyph.glyphId}`)
      }
      bounds.set(quadBounds(item.glyph, cached.viewBox, item.glyph.fontUnitScale), index * 4)
      slots[index] = cached.slot
      const color = styleColors.get(item.glyph.styleKey) ?? defaultColor
      colors.set(
        [color.r, color.g, color.b].map((component) =>
          Math.round(Math.max(0, Math.min(1, component)) * 255),
        ),
        index * 3,
      )
    }
    return {
      layout,
      resources,
      instances: { bounds, slots, colors, count: renderable.length },
      opacity: snapshot.opacity,
      clipRect: snapshot.clipRect,
    }
  }
}

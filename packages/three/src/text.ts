import type { LayoutBounds, LayoutResult, PositionedGlyph } from '@webgpu-text/layout'
import { generateSdf, type SdfBitmap, type SdfViewBox } from '@webgpu-text/sdf'
import { Color, type ColorRepresentation, Mesh } from 'three/webgpu'

import { type AtlasAddition, type AtlasPlan, type CachedGlyph, RgbaGlyphAtlas } from './atlas.js'
import { DisposedTextError, InvalidTextInputError } from './errors.js'
import {
  createGlyphGeometry,
  createGlyphMaterial,
  type GlyphInstanceData,
  type GlyphMaterialControls,
  updateGlyphGeometry,
  updateGlyphMaterial,
} from './rendering.js'
import type { TextFont, TextGlyphOutline, TextMaterial, TextOptions } from './types.js'

const DEFAULT_COLOR = 0xffffff
const DEFAULT_SDF_SIZE = 64
const SDF_EXPONENT = 9

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
  readonly atlas: AtlasPlan
  readonly instances: GlyphInstanceData
  readonly opacity: number
  readonly clipRect: LayoutBounds | null
}

interface ResolvedRenderableGlyph {
  readonly glyph: PositionedGlyph
  readonly key: string
}

function invalid(message: string, cause?: unknown): InvalidTextInputError {
  return new InvalidTextInputError(message, cause === undefined ? undefined : { cause })
}

function validateSdfSize(size: number): void {
  if (!Number.isSafeInteger(size) || size < 16 || size > 512) {
    throw invalid('sdfSize must be a safe integer from 16 through 512')
  }
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

function variationKey(variations: Readonly<Record<string, number>>): string {
  return Object.entries(variations)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([axis, value]) => `${axis}:${value}`)
    .join(',')
}

function hasDrawableCommand(commands: Uint8Array): boolean {
  return commands.some((command) => command === 1 || command === 2 || command === 3)
}

function paddedBitmap(
  font: TextFont,
  glyphId: number,
  variations: Readonly<Record<string, number>>,
  size: number,
): SdfBitmap | null {
  let outline: TextGlyphOutline
  try {
    outline = font.getOutline(glyphId, variations)
  } catch (error) {
    throw invalid(`Unable to resolve outline for glyph ${glyphId}`, error)
  }
  if (!hasDrawableCommand(outline.commands)) return null
  const { xMin, yMin, xMax, yMax } = outline.bounds
  if (![xMin, yMin, xMax, yMax].every(Number.isFinite) || xMin > xMax || yMin > yMax) {
    throw invalid(`Glyph ${glyphId} has invalid outline bounds`)
  }
  const extent = Math.max(xMax - xMin, yMax - yMin)
  if (!(extent > 0)) return null
  const paddingPixels = Math.max(2, Math.floor(size / 8))
  const contentPixels = size - paddingPixels * 2
  const unitsPerPixel = extent / contentPixels
  const viewExtent = unitsPerPixel * size
  const centerX = (xMin + xMax) / 2
  const centerY = (yMin + yMax) / 2
  const viewBox: SdfViewBox = {
    left: centerX - viewExtent / 2,
    bottom: centerY - viewExtent / 2,
    right: centerX + viewExtent / 2,
    top: centerY + viewExtent / 2,
  }
  return generateSdf({
    outline,
    viewBox,
    width: size,
    height: size,
    distance: unitsPerPixel * paddingPixels,
    exponent: SDF_EXPONENT,
  })
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

  readonly #atlas: RgbaGlyphAtlas
  readonly #controls: GlyphMaterialControls
  readonly #fontIds = new WeakMap<TextFont, number>()
  #nextFontId = 1
  #revision = 0
  #pending: Promise<void> | null = null
  #latest: SyncSnapshot | null = null
  #layoutResult: LayoutResult | null = null
  #disposed = false

  constructor(options: TextOptions) {
    const sdfSize = options.sdfSize ?? DEFAULT_SDF_SIZE
    const lit = options.lit ?? false
    validateSdfSize(sdfSize)
    if (typeof lit !== 'boolean') throw invalid('lit must be a boolean')
    const atlas = new RgbaGlyphAtlas(sdfSize)
    const geometry = createGlyphGeometry()
    const rendered = createGlyphMaterial(atlas.texture, lit)
    super(geometry, rendered.material)
    this.layout = options.layout
    this.fonts = options.fonts
    this.color = options.color ?? DEFAULT_COLOR
    this.styleColors = options.styleColors ?? {}
    this.opacity = options.opacity ?? 1
    this.clipRect = options.clipRect ?? null
    this.lit = lit
    this.sdfSize = sdfSize
    this.#atlas = atlas
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
    this.#atlas.dispose()
  }

  async #flush(): Promise<void> {
    try {
      const snapshot = this.#latest
      if (this.#disposed || !snapshot) throw new DisposedTextError()
      const built = this.#build(snapshot)
      if (this.#disposed || snapshot.revision !== this.#revision) throw new DisposedTextError()
      updateGlyphGeometry(this.geometry, built.instances, built.layout.blockBounds)
      this.#atlas.commit(built.atlas)
      updateGlyphMaterial(this.#controls, built.atlas.gridSize, built.opacity, built.clipRect)
      this.#layoutResult = built.layout
    } finally {
      this.#latest = null
      this.#pending = null
    }
  }

  #fontId(font: TextFont): number {
    let id = this.#fontIds.get(font)
    if (id === undefined) {
      id = this.#nextFontId++
      this.#fontIds.set(font, id)
    }
    return id
  }

  #resolveGlyph(
    snapshot: SyncSnapshot,
    glyph: PositionedGlyph,
    additions: AtlasAddition[],
    local: Map<string, CachedGlyph>,
  ): ResolvedRenderableGlyph | null {
    const font = snapshot.fonts.get(glyph.fontKey)
    if (!font || (typeof font !== 'object' && typeof font !== 'function')) {
      throw invalid(`Font registry has no usable entry for ${glyph.fontKey}`)
    }
    const key = `${this.#fontId(font)}:${glyph.glyphId}:${variationKey(glyph.variations)}:${this.sdfSize}`
    let cached = this.#atlas.lookup(key) ?? local.get(key)
    if (cached === undefined) {
      const bitmap = paddedBitmap(font, glyph.glyphId, glyph.variations, this.sdfSize)
      additions.push({ key, bitmap })
      cached = { slot: bitmap ? -1 : null, viewBox: bitmap?.viewBox ?? null }
      local.set(key, cached)
    }
    if (cached.slot === null) return null
    return { glyph, key }
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
    const additions: AtlasAddition[] = []
    const local = new Map<string, CachedGlyph>()
    const renderable: ResolvedRenderableGlyph[] = []
    for (const glyph of layout.glyphs) {
      const resolved = this.#resolveGlyph(snapshot, glyph, additions, local)
      if (resolved) renderable.push(resolved)
    }
    const atlas = this.#atlas.plan(additions)
    const bounds = new Float32Array(renderable.length * 4)
    const slots = new Uint32Array(renderable.length)
    const colors = new Uint8Array(renderable.length * 3)
    for (const [index, item] of renderable.entries()) {
      const cached = atlas.glyphs.get(item.key)
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
      atlas,
      instances: { bounds, slots, colors, count: renderable.length },
      opacity: snapshot.opacity,
      clipRect: snapshot.clipRect,
    }
  }
}

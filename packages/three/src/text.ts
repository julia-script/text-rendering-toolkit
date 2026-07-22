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

/**
 * A Three.js mesh that renders a completed `LayoutResult` as instanced SDF
 * glyph quads.
 *
 * @remarks
 * An ordinary `Mesh`, so it goes into a scene, accepts transforms, and honors
 * `castShadow` / `receiveShadow` like anything else. `frustumCulled` is
 * disabled because glyph quads are positioned entirely on the GPU, leaving the
 * mesh's own bounding volume unrepresentative of what it draws.
 *
 * The API deliberately starts *after* font loading, itemization, shaping, and
 * layout: hand it a finished layout plus the fonts its keys refer to.
 *
 * Appearance and layout properties are plain mutable fields — assigning one
 * changes nothing on screen until you call and await {@link Text.sync}. That
 * two-step design is what allows several edits to batch into a single GPU
 * update.
 *
 * Requires a Three.js `WebGPURenderer`; no legacy-renderer fallback is provided.
 *
 * @example
 * Create, sync, and add to a scene.
 * ```typescript
 * const text = new Text({
 *   layout: layoutResolvedText(input),
 *   fonts: new Map([['body', font]]),
 *   color: 0xffffff,
 *   styleColors: { emphasis: 0xffcc33 },
 * })
 * await text.sync()
 * scene.add(text)
 * ```
 *
 * @example
 * Update several properties with one GPU commit, then read back what rendered.
 * ```typescript
 * text.layout = layoutResolvedText(nextInput)
 * text.opacity = 0.8
 * await text.sync()
 *
 * const committed = text.layoutResult
 * const selection = committed ? getSelectionRects(committed, { start: 0, end: 5 }) : []
 * ```
 *
 * @see {@link TextResources} for sharing one atlas across several instances.
 */
export class Text extends Mesh<ReturnType<typeof createGlyphGeometry>, TextMaterial> {
  /** Layout to render; assign a new one and call {@link Text.sync}. */
  layout: LayoutResult
  /** Fonts backing the layout's font keys. Must cover every key it uses. */
  fonts: ReadonlyMap<string, TextFont>
  /** Base text color for glyphs with no matching {@link Text.styleColors} entry. */
  color: ColorRepresentation
  /** Per-style color overrides, keyed by the layout's style keys. */
  styleColors: Readonly<Record<string, ColorRepresentation>>
  /** Uniform opacity from `0` through `1`. */
  opacity: number
  /** Local rectangular clip in layout coordinates, or `null`. */
  clipRect: LayoutBounds | null
  /** Whether this object uses the lit standard material. Fixed at construction. */
  readonly lit: boolean
  /**
   * SDF cell size in texels actually in effect.
   *
   * @remarks
   * When resources were injected this is the owner's size, which may differ
   * from any value passed at construction.
   */
  readonly sdfSize: number

  readonly #resources: TextResources
  readonly #ownsResources: boolean
  readonly #controls: GlyphMaterialControls
  #revision = 0
  #pending: Promise<void> | null = null
  #latest: SyncSnapshot | null = null
  #layoutResult: LayoutResult | null = null
  #disposed = false

  /**
   * Builds the mesh, its geometry, and its material, but renders nothing until
   * {@link Text.sync} is awaited.
   *
   * @param options - Layout, fonts, appearance, and either shared `resources`
   *   or an owned `sdfSize`.
   * @throws {@link InvalidTextInputError} if both `resources` and `sdfSize` are
   *   given, if `resources` is not a {@link TextResources}, if `lit` is not a
   *   boolean, or if `sdfSize` is outside `16`–`512`.
   * @throws {@link DisposedTextResourcesError} if the injected resources have
   *   already been disposed.
   */
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

  /**
   * The exact layout committed by the last successful {@link Text.sync}, or
   * `null` before the first one.
   *
   * @remarks
   * Not the same as {@link Text.layout}, which is whatever you assigned most
   * recently and may not be on screen yet. Use this one for hit testing,
   * selection, and measurement so geometry always matches what is rendered — a
   * failed sync leaves the previous value intact rather than clearing it.
   */
  get layoutResult(): LayoutResult | null {
    return this.#layoutResult
  }

  /**
   * The committed layout together with the number of instances drawn for it, or
   * `null` before the first successful sync.
   *
   * @remarks
   * `instanceCount` counts quads, not characters: a color glyph contributes one
   * instance per layer, and blank glyphs such as spaces contribute none.
   */
  get committedState(): {
    readonly layoutResult: LayoutResult
    readonly instanceCount: number
  } | null {
    return this.#layoutResult
      ? { layoutResult: this.#layoutResult, instanceCount: this.geometry.instanceCount }
      : null
  }

  /**
   * Applies pending property changes: generates any missing glyph SDFs, grows
   * the atlas, and updates geometry and material.
   *
   * @remarks
   * Property assignments are inert until this runs, so a batch of edits costs
   * one GPU update rather than one each.
   *
   * Calls made in the same microtask **share a single promise** and commit only
   * the newest captured state; intermediate states are skipped rather than
   * rendered in sequence. Calling it in a loop or on every frame is therefore
   * safe and cheap.
   *
   * Current property values are snapshotted when `sync()` is called, not when
   * the work runs — mutating a property immediately afterwards affects the
   * *next* sync, not this one.
   *
   * Updates are atomic: a rejection leaves the last successfully rendered state
   * untouched, including {@link Text.layoutResult}, so a failure never puts the
   * object into a partially-updated state.
   *
   * @returns A promise resolving once the update has been committed.
   * @throws {@link DisposedTextError} — as a rejection — if this object, or a
   *   newer sync superseding this one, was disposed before the work ran.
   * @throws {@link InvalidTextInputError} — as a rejection — for an invalid
   *   opacity, clip rect, color, or layout, or a font key the registry does not
   *   cover.
   *
   * @example
   * Several edits coalesce into one commit.
   * ```typescript
   * text.opacity = 0.25
   * const first = text.sync()
   * text.opacity = 0.5
   * const second = text.sync()
   * first === second // true — one shared promise
   * await second // commits opacity 0.5; 0.25 is never rendered
   * ```
   */
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

  /**
   * Releases this object's geometry and material, and its resources if it owns
   * them.
   *
   * @remarks
   * Idempotent. Injected {@link TextResources} are left alone — the owner
   * disposes those — so dispose every borrower before its owner. Remove the
   * mesh from its scene separately; this does not detach it.
   *
   * Afterwards {@link Text.sync} rejects with {@link DisposedTextError}, and any
   * in-flight sync is abandoned without committing.
   */
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
    const colors = new Uint8Array(renderable.length * 4)
    for (const [index, item] of renderable.entries()) {
      const cached = resources.atlas.glyphs.get(item.key)
      if (!cached || cached.slot === null || !cached.viewBox) {
        throw invalid(`Atlas plan is missing glyph ${item.outlineGlyphId}`)
      }
      bounds.set(quadBounds(item.glyph, cached.viewBox, item.glyph.fontUnitScale), index * 4)
      slots[index] = cached.slot
      const foreground = styleColors.get(item.glyph.styleKey) ?? defaultColor
      const color = item.paint === 'foreground' ? foreground : item.paint
      const components =
        color instanceof Color
          ? [color.r, color.g, color.b].map((component) =>
              Math.round(Math.max(0, Math.min(1, component)) * 255),
            )
          : [color.red, color.green, color.blue]
      colors.set([...components, item.paint === 'foreground' ? 255 : item.paint.alpha], index * 4)
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

import type { PositionedGlyph } from '@webgpu-text/layout'
import { generateSdf, type SdfBitmap, type SdfViewBox } from '@webgpu-text/sdf'
import { type DataTexture, Vector2 } from 'three/webgpu'

import { type AtlasAddition, type AtlasPlan, type CachedGlyph, RgbaGlyphAtlas } from './atlas.js'
import { DisposedTextResourcesError, InvalidTextInputError } from './errors.js'
import type {
  TextColorGlyphLayer,
  TextColorGlyphPaint,
  TextFont,
  TextGlyphOutline,
  TextResourcesOptions,
} from './types.js'

/** SDF cell size used when the caller specifies none. */
const DEFAULT_SDF_SIZE = 64

/** Falloff exponent for generated fields; concentrates precision near the edge. */
const SDF_EXPONENT = 9

interface ResourceState {
  readonly atlas: RgbaGlyphAtlas
  readonly atlasGrid: Vector2
  readonly fontIds: WeakMap<TextFont, number>
  readonly colorLayers: WeakMap<TextFont, Map<number, readonly TextColorGlyphLayer[] | null>>
  nextFontId: number
  disposed: boolean
}

export interface TextResourceBinding {
  readonly texture: DataTexture
  readonly atlasGrid: Vector2
}

export interface PlannedTextGlyph {
  readonly glyph: PositionedGlyph
  readonly outlineGlyphId: number
  readonly paint: TextColorGlyphPaint
  readonly key: string
}

export interface TextResourcePlan {
  readonly atlas: AtlasPlan
  readonly glyphs: readonly PlannedTextGlyph[]
}

/**
 * Internal state, held outside the class so the public surface stays two
 * members and disposal can be enforced on every access via {@link state}.
 */
const states = new WeakMap<TextResources, ResourceState>()

function invalid(message: string, cause?: unknown): InvalidTextInputError {
  return new InvalidTextInputError(message, cause === undefined ? undefined : { cause })
}

function validateSdfSize(size: number): void {
  if (!Number.isSafeInteger(size) || size < 16 || size > 512) {
    throw invalid('sdfSize must be a safe integer from 16 through 512')
  }
}

/** Reads live state, rejecting any use after disposal. */
function state(resources: TextResources): ResourceState {
  const value = states.get(resources)
  if (!value || value.disposed) throw new DisposedTextResourcesError()
  return value
}

/** Serializes variation coordinates in sorted order, so key equality is order-independent. */
function variationKey(variations: Readonly<Record<string, number>>): string {
  return Object.entries(variations)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([axis, value]) => `${axis}:${value}`)
    .join(',')
}

/**
 * Whether an outline contains any line or curve, as opposed to only moves and
 * closes. Blank glyphs such as spaces are skipped rather than given atlas slots.
 */
function hasDrawableCommand(commands: Uint8Array): boolean {
  return commands.some((command) => command === 1 || command === 2 || command === 3)
}

/**
 * Generates one glyph's SDF, framed in a square view box with uniform padding.
 *
 * The glyph is fitted by its larger axis and centered, so cells stay square and
 * comparable regardless of glyph aspect. Padding is reserved on all sides and
 * used as the SDF distance range, which is what keeps the falloff from being
 * clipped at the cell edge.
 *
 * @returns `null` for a blank or zero-extent glyph, which needs no atlas slot.
 */
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
  const unitsPerPixel = extent / (size - paddingPixels * 2)
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

/**
 * Assigns each font handle a stable small integer for cache keys.
 *
 * Keyed by handle identity through a `WeakMap`, which is why two handles over
 * identical bytes do not share cache entries.
 */
function fontId(value: ResourceState, font: TextFont): number {
  let id = value.fontIds.get(font)
  if (id === undefined) {
    id = value.nextFontId++
    value.fontIds.set(font, id)
  }
  return id
}

/** Whether a value is an integer in the 0-255 palette byte range. */
function validByte(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 255
}

/**
 * Reads and validates a glyph's color layers, memoizing per font and glyph.
 *
 * Fonts are caller-supplied and may be any object satisfying {@link TextFont},
 * so results are validated rather than trusted, and frozen before caching. Both
 * hits and misses are cached, keeping repeated probes of ordinary glyphs cheap.
 *
 * @returns Frozen layers, or `null` when the font has no color data for this
 *   glyph or exposes no lookup at all.
 */
function resolvedColorLayers(
  value: ResourceState,
  font: TextFont,
  glyphId: number,
): readonly TextColorGlyphLayer[] | null {
  let cache = value.colorLayers.get(font)
  if (!cache) {
    cache = new Map()
    value.colorLayers.set(font, cache)
  }
  if (cache.has(glyphId)) return cache.get(glyphId) ?? null

  const lookup = font.getColorLayers
  if (lookup === undefined) {
    cache.set(glyphId, null)
    return null
  }
  if (typeof lookup !== 'function') throw invalid('Font color lookup must be a function')

  let result: readonly TextColorGlyphLayer[] | null
  try {
    result = lookup.call(font, glyphId)
  } catch (error) {
    throw invalid(`Unable to resolve color layers for glyph ${glyphId}`, error)
  }
  if (result === null) {
    cache.set(glyphId, null)
    return null
  }
  if (!Array.isArray(result) || result.length === 0) {
    throw invalid(`Color layers for glyph ${glyphId} must be a non-empty array or null`)
  }
  const layers = Object.freeze(
    result.map((layer, index): TextColorGlyphLayer => {
      if (
        !layer ||
        typeof layer !== 'object' ||
        !Number.isSafeInteger(layer.glyphId) ||
        layer.glyphId < 0 ||
        layer.glyphId > 0xffffffff
      ) {
        throw invalid(`Color layer ${index} for glyph ${glyphId} has an invalid glyphId`)
      }
      const color = layer.color
      if (color === 'foreground') return Object.freeze({ glyphId: layer.glyphId, color })
      if (
        !color ||
        typeof color !== 'object' ||
        !validByte(color.red) ||
        !validByte(color.green) ||
        !validByte(color.blue) ||
        !validByte(color.alpha)
      ) {
        throw invalid(`Color layer ${index} for glyph ${glyphId} has invalid RGBA bytes`)
      }
      return Object.freeze({ glyphId: layer.glyphId, color: Object.freeze({ ...color }) })
    }),
  )
  cache.set(glyphId, layers)
  return layers
}

/**
 * A shareable glyph SDF cache and atlas texture, owned by the application.
 *
 * @remarks
 * Inject one into several {@link Text} objects so they share generated glyph
 * SDFs and a single growing atlas texture. Each `Text` still owns its geometry,
 * material, and draw call — sharing saves SDF generation and texture memory,
 * not draw calls.
 *
 * Cache identity is the font *handle* itself, plus glyph id, variation
 * coordinates, and SDF size. Loading the same font bytes twice produces two
 * handles and therefore two cache entries, so reuse the handle when reuse
 * matters.
 *
 * Without injection, each `Text` silently creates and owns a private instance —
 * which is the right default for a single object and wasteful for many.
 *
 * The cache only grows: there is no eviction, no partial upload, and no
 * background scheduling.
 *
 * @example
 * Share one atlas across labels, disposing borrowers before the owner.
 * ```typescript
 * const resources = new TextResources({ sdfSize: 64 })
 * const title = new Text({ layout: titleLayout, fonts, resources })
 * const label = new Text({ layout: labelLayout, fonts, resources })
 * await Promise.all([title.sync(), label.sync()])
 *
 * title.dispose()
 * label.dispose()
 * resources.dispose()
 * ```
 */
export class TextResources {
  /** SDF cell size in texels; fixed for this instance's lifetime. */
  readonly sdfSize: number

  /**
   * @param options - Optional SDF cell size.
   * @throws {@link InvalidTextInputError} if `sdfSize` is not a safe integer
   *   from `16` through `512`.
   */
  constructor(options: TextResourcesOptions = {}) {
    const sdfSize = options.sdfSize ?? DEFAULT_SDF_SIZE
    validateSdfSize(sdfSize)
    this.sdfSize = sdfSize
    states.set(this, {
      atlas: new RgbaGlyphAtlas(sdfSize),
      atlasGrid: new Vector2(1, 1),
      fontIds: new WeakMap(),
      colorLayers: new WeakMap(),
      nextFontId: 1,
      disposed: false,
    })
  }

  /**
   * Releases the atlas texture and cached glyph data.
   *
   * @remarks
   * Idempotent. Dispose every borrowing {@link Text} first: afterwards any
   * operation touching these resources — including constructing a new `Text`
   * against them — throws {@link DisposedTextResourcesError}.
   */
  dispose(): void {
    const value = states.get(this)
    if (!value || value.disposed) return
    value.disposed = true
    value.atlas.dispose()
  }
}

export function textResourceBinding(resources: TextResources): TextResourceBinding {
  const value = state(resources)
  return { texture: value.atlas.texture, atlasGrid: value.atlasGrid }
}

/**
 * Resolves every glyph the layout needs, generating missing SDFs, and returns a
 * plan without mutating the shared state.
 *
 * Expanding color glyphs into per-layer entries happens here, so a color glyph
 * contributes several planned entries sharing one source glyph. Blank glyphs
 * resolve to a `null` slot and are dropped from the plan rather than occupying
 * atlas space.
 *
 * Purity is the point: this is the failure-prone half (outline resolution, SDF
 * generation, validation), and keeping it side-effect free is what lets a failed
 * sync leave the atlas exactly as it was. {@link commitTextResources} performs
 * the mutation afterwards.
 */
export function planTextResources(
  resources: TextResources,
  glyphs: readonly PositionedGlyph[],
  fonts: ReadonlyMap<string, TextFont>,
): TextResourcePlan {
  const value = state(resources)
  const additions: AtlasAddition[] = []
  const local = new Map<string, CachedGlyph>()
  const planned: PlannedTextGlyph[] = []
  for (const glyph of glyphs) {
    const font = fonts.get(glyph.fontKey)
    if (!font || (typeof font !== 'object' && typeof font !== 'function')) {
      throw invalid(`Font registry has no usable entry for ${glyph.fontKey}`)
    }
    const colorLayers = resolvedColorLayers(value, font, glyph.glyphId) ?? [
      { glyphId: glyph.glyphId, color: 'foreground' as const },
    ]
    for (const layer of colorLayers) {
      const key = `${fontId(value, font)}:${layer.glyphId}:${variationKey(glyph.variations)}:${resources.sdfSize}`
      let cached = value.atlas.lookup(key) ?? local.get(key)
      if (cached === undefined) {
        const bitmap = paddedBitmap(font, layer.glyphId, glyph.variations, resources.sdfSize)
        additions.push({ key, bitmap })
        cached = { slot: bitmap ? -1 : null, viewBox: bitmap?.viewBox ?? null }
        local.set(key, cached)
      }
      if (cached.slot !== null) {
        planned.push({ glyph, outlineGlyphId: layer.glyphId, paint: layer.color, key })
      }
    }
  }
  return { atlas: value.atlas.plan(additions), glyphs: planned }
}

/**
 * Applies a plan from {@link planTextResources} to the shared state, uploading
 * atlas pixels and updating the grid size uniform.
 *
 * The mutating half of the pair; call it only once the caller is committed to
 * the update.
 */
export function commitTextResources(resources: TextResources, plan: TextResourcePlan): void {
  const value = state(resources)
  value.atlas.commit(plan.atlas)
  value.atlasGrid.set(plan.atlas.gridSize, plan.atlas.gridSize)
}

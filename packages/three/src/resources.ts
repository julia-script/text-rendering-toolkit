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

const DEFAULT_SDF_SIZE = 64
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

const states = new WeakMap<TextResources, ResourceState>()

function invalid(message: string, cause?: unknown): InvalidTextInputError {
  return new InvalidTextInputError(message, cause === undefined ? undefined : { cause })
}

function validateSdfSize(size: number): void {
  if (!Number.isSafeInteger(size) || size < 16 || size > 512) {
    throw invalid('sdfSize must be a safe integer from 16 through 512')
  }
}

function state(resources: TextResources): ResourceState {
  const value = states.get(resources)
  if (!value || value.disposed) throw new DisposedTextResourcesError()
  return value
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

function fontId(value: ResourceState, font: TextFont): number {
  let id = value.fontIds.get(font)
  if (id === undefined) {
    id = value.nextFontId++
    value.fontIds.set(font, id)
  }
  return id
}

function validByte(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 255
}

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

export class TextResources {
  readonly sdfSize: number

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

export function commitTextResources(resources: TextResources, plan: TextResourcePlan): void {
  const value = state(resources)
  value.atlas.commit(plan.atlas)
  value.atlasGrid.set(plan.atlas.gridSize, plan.atlas.gridSize)
}

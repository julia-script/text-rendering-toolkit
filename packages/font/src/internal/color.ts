import { InvalidFontError } from '../errors.js'
import type { ColorGlyphLayer, RgbaColor } from '../types.js'
import { assertSfntBounds, sfntTable, sfntTableRecords, sfntView } from './sfnt.js'

interface ColrV0Data {
  readonly colr: DataView
  readonly baseCount: number
  readonly baseOffset: number
  readonly layerOffset: number
  readonly layerCount: number
  readonly palette: readonly RgbaColor[]
}

function invalid(message: string): InvalidFontError {
  return new InvalidFontError(`Invalid color font data: ${message}`)
}

/**
 * Reads palette zero out of CPAL.
 *
 * Color records are stored BGRA on disk, so the channel reads look transposed
 * but are not. Only palette zero is exposed — picking among a font's alternate
 * palettes is a policy decision left to callers of a future API.
 */
function paletteZero(cpal: Uint8Array): readonly RgbaColor[] {
  assertSfntBounds(cpal, 0, 12, 'CPAL header')
  const data = sfntView(cpal)
  const version = data.getUint16(0, false)
  if (version > 1) throw invalid(`unsupported CPAL version ${version}`)
  const entryCount = data.getUint16(2, false)
  const paletteCount = data.getUint16(4, false)
  const colorRecordCount = data.getUint16(6, false)
  const colorRecordsOffset = data.getUint32(8, false)
  if (paletteCount === 0) throw invalid('CPAL has no palettes')
  assertSfntBounds(cpal, 12, paletteCount * 2, 'CPAL palette indices')
  assertSfntBounds(cpal, colorRecordsOffset, colorRecordCount * 4, 'CPAL color records')
  const firstColor = data.getUint16(12, false)
  if (firstColor + entryCount > colorRecordCount) {
    throw invalid('CPAL palette zero exceeds its color records')
  }
  return Object.freeze(
    Array.from({ length: entryCount }, (_, index) => {
      const offset = colorRecordsOffset + (firstColor + index) * 4
      return Object.freeze({
        blue: data.getUint8(offset),
        green: data.getUint8(offset + 1),
        red: data.getUint8(offset + 2),
        alpha: data.getUint8(offset + 3),
      })
    }),
  )
}

/**
 * Parses and fully validates the COLR/CPAL pair once, or returns `null` when
 * the font has no COLR v0 data to read.
 *
 * `null` covers both "no COLR table" and "COLR version other than 0" — a COLR
 * v1 font is a supported input that simply has no v0 layers, not an error.
 * Validation is eager and total: base records must be strictly ascending (the
 * binary search in {@link ColorLayerReader.get} depends on it), every layer
 * range must fall inside the layer array, and every palette index must resolve.
 * Paying that cost once means the per-glyph path can read without re-checking.
 */
function initialize(bytes: Uint8Array): ColrV0Data | null {
  const records = sfntTableRecords(bytes)
  const colrBytes = sfntTable(bytes, records, 'COLR')
  if (!colrBytes) return null
  assertSfntBounds(colrBytes, 0, 2, 'COLR header')
  const colr = sfntView(colrBytes)
  if (colr.getUint16(0, false) !== 0) return null

  assertSfntBounds(colrBytes, 0, 14, 'COLR v0 header')
  const baseCount = colr.getUint16(2, false)
  const baseOffset = colr.getUint32(4, false)
  const layerOffset = colr.getUint32(8, false)
  const layerCount = colr.getUint16(12, false)
  assertSfntBounds(colrBytes, baseOffset, baseCount * 6, 'COLR base glyph records')
  assertSfntBounds(colrBytes, layerOffset, layerCount * 4, 'COLR layer records')

  let previousGlyphId = -1
  for (let index = 0; index < baseCount; index += 1) {
    const offset = baseOffset + index * 6
    const glyphId = colr.getUint16(offset, false)
    const firstLayer = colr.getUint16(offset + 2, false)
    const count = colr.getUint16(offset + 4, false)
    if (glyphId <= previousGlyphId) throw invalid('COLR base glyph records are not ordered')
    if (count === 0 || firstLayer + count > layerCount) {
      throw invalid('COLR base glyph layer range is invalid')
    }
    previousGlyphId = glyphId
  }

  const cpalBytes = sfntTable(bytes, records, 'CPAL')
  if (!cpalBytes) throw invalid('COLR v0 requires a CPAL table')
  const palette = paletteZero(cpalBytes)
  for (let index = 0; index < layerCount; index += 1) {
    const paletteIndex = colr.getUint16(layerOffset + index * 4 + 2, false)
    if (paletteIndex !== 0xffff && paletteIndex >= palette.length) {
      throw invalid('COLR layer references an unavailable palette entry')
    }
  }

  return { colr, baseCount, baseOffset, layerOffset, layerCount, palette }
}

/**
 * Lazily parses a font's COLR v0 and CPAL tables and resolves per-glyph layers,
 * caching both the parse and every lookup.
 *
 * The tables are untouched until the first {@link ColorLayerReader.get} call, so
 * an ordinary outline font never pays to parse tables it does not have. Misses
 * are cached as `null` alongside hits, which keeps repeated probes of non-color
 * glyphs — the common case during a render pass — down to a map lookup.
 */
export class ColorLayerReader {
  #bytes: Uint8Array | null
  #data: ColrV0Data | null = null
  #initialized = false
  readonly #cache = new Map<number, readonly ColorGlyphLayer[] | null>()

  constructor(bytes: ArrayBuffer) {
    this.#bytes = new Uint8Array(bytes)
  }

  /**
   * Resolves one glyph's layers in painting order, or `null` if it has none.
   *
   * Binary searches the COLR base records, which {@link initialize} has already
   * verified are strictly ascending.
   */
  get(glyphId: number): readonly ColorGlyphLayer[] | null {
    const cached = this.#cache.get(glyphId)
    if (cached !== undefined || this.#cache.has(glyphId)) return cached ?? null
    const bytes = this.#bytes
    if (!bytes) throw new InvalidFontError('Font color data has been released')
    if (!this.#initialized) {
      this.#data = initialize(bytes)
      this.#initialized = true
    }
    const data = this.#data
    if (!data || glyphId > 0xffff) {
      this.#cache.set(glyphId, null)
      return null
    }

    let low = 0
    let high = data.baseCount - 1
    while (low <= high) {
      const middle = (low + high) >>> 1
      const record = data.baseOffset + middle * 6
      const candidate = data.colr.getUint16(record, false)
      if (candidate < glyphId) low = middle + 1
      else if (candidate > glyphId) high = middle - 1
      else {
        const firstLayer = data.colr.getUint16(record + 2, false)
        const count = data.colr.getUint16(record + 4, false)
        const layers = Object.freeze(
          Array.from({ length: count }, (_, index): ColorGlyphLayer => {
            const offset = data.layerOffset + (firstLayer + index) * 4
            const paletteIndex = data.colr.getUint16(offset + 2, false)
            const color = paletteIndex === 0xffff ? 'foreground' : data.palette[paletteIndex]
            if (!color) throw invalid('COLR layer references an unavailable palette entry')
            return Object.freeze({
              glyphId: data.colr.getUint16(offset, false),
              color,
            })
          }),
        )
        this.#cache.set(glyphId, layers)
        return layers
      }
    }
    this.#cache.set(glyphId, null)
    return null
  }

  /** Drops the cache, the parsed tables, and the reference to the font bytes. */
  dispose(): void {
    this.#cache.clear()
    this.#data = null
    this.#bytes = null
  }
}

import { InvalidFontError } from '../errors.js'
import type { ColorGlyphLayer, RgbaColor } from '../types.js'

interface TableRecord {
  readonly offset: number
  readonly length: number
}

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

function assertBounds(bytes: Uint8Array, offset: number, size: number, label: string): void {
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(size) ||
    offset < 0 ||
    size < 0 ||
    offset + size > bytes.byteLength
  ) {
    throw invalid(`${label} exceeds its table`)
  }
}

function dataView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

function tableRecords(bytes: Uint8Array): ReadonlyMap<string, TableRecord> {
  assertBounds(bytes, 0, 12, 'SFNT header')
  const data = dataView(bytes)
  const count = data.getUint16(4, false)
  assertBounds(bytes, 12, count * 16, 'SFNT table directory')
  const records = new Map<string, TableRecord>()
  for (let index = 0; index < count; index += 1) {
    const record = 12 + index * 16
    const name = String.fromCharCode(
      bytes[record] ?? 0,
      bytes[record + 1] ?? 0,
      bytes[record + 2] ?? 0,
      bytes[record + 3] ?? 0,
    )
    records.set(name, {
      offset: data.getUint32(record + 8, false),
      length: data.getUint32(record + 12, false),
    })
  }
  return records
}

function table(
  bytes: Uint8Array,
  records: ReadonlyMap<string, TableRecord>,
  name: string,
): Uint8Array | null {
  const record = records.get(name)
  if (!record) return null
  assertBounds(bytes, record.offset, record.length, `${name} table`)
  return bytes.subarray(record.offset, record.offset + record.length)
}

function paletteZero(cpal: Uint8Array): readonly RgbaColor[] {
  assertBounds(cpal, 0, 12, 'CPAL header')
  const data = dataView(cpal)
  const version = data.getUint16(0, false)
  if (version > 1) throw invalid(`unsupported CPAL version ${version}`)
  const entryCount = data.getUint16(2, false)
  const paletteCount = data.getUint16(4, false)
  const colorRecordCount = data.getUint16(6, false)
  const colorRecordsOffset = data.getUint32(8, false)
  if (paletteCount === 0) throw invalid('CPAL has no palettes')
  assertBounds(cpal, 12, paletteCount * 2, 'CPAL palette indices')
  assertBounds(cpal, colorRecordsOffset, colorRecordCount * 4, 'CPAL color records')
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

function initialize(bytes: Uint8Array): ColrV0Data | null {
  const records = tableRecords(bytes)
  const colrBytes = table(bytes, records, 'COLR')
  if (!colrBytes) return null
  assertBounds(colrBytes, 0, 2, 'COLR header')
  const colr = dataView(colrBytes)
  if (colr.getUint16(0, false) !== 0) return null

  assertBounds(colrBytes, 0, 14, 'COLR v0 header')
  const baseCount = colr.getUint16(2, false)
  const baseOffset = colr.getUint32(4, false)
  const layerOffset = colr.getUint32(8, false)
  const layerCount = colr.getUint16(12, false)
  assertBounds(colrBytes, baseOffset, baseCount * 6, 'COLR base glyph records')
  assertBounds(colrBytes, layerOffset, layerCount * 4, 'COLR layer records')

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

  const cpalBytes = table(bytes, records, 'CPAL')
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

export class ColorLayerReader {
  #bytes: Uint8Array | null
  #data: ColrV0Data | null = null
  #initialized = false
  readonly #cache = new Map<number, readonly ColorGlyphLayer[] | null>()

  constructor(bytes: ArrayBuffer) {
    this.#bytes = new Uint8Array(bytes)
  }

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

  dispose(): void {
    this.#cache.clear()
    this.#data = null
    this.#bytes = null
  }
}

export interface SfntTable {
  readonly tag: string
  readonly offset: number
  readonly length: number
}

export interface ColorLayer {
  readonly glyphId: number
  readonly paletteIndex: number
}

export interface RgbaColor {
  readonly red: number
  readonly green: number
  readonly blue: number
  readonly alpha: number
}

export interface SbixStrike {
  readonly ppem: number
  readonly resolution: number
}

export interface SvgDocumentRange {
  readonly startGlyphId: number
  readonly endGlyphId: number
  readonly compressed: boolean
  readonly byteLength: number
}

function bounds(bytes: Uint8Array, offset: number, size: number, label: string): void {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset + size > bytes.length) {
    throw new RangeError(`${label} exceeds font data`)
  }
}

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

function tag(bytes: Uint8Array, offset: number): string {
  bounds(bytes, offset, 4, 'tag')
  return String.fromCharCode(...bytes.subarray(offset, offset + 4))
}

export function sfntTables(bytes: Uint8Array): ReadonlyMap<string, SfntTable> {
  bounds(bytes, 0, 12, 'SFNT header')
  const data = view(bytes)
  const count = data.getUint16(4)
  bounds(bytes, 12, count * 16, 'SFNT table directory')
  const tables = new Map<string, SfntTable>()
  for (let index = 0; index < count; index += 1) {
    const record = 12 + index * 16
    const name = tag(bytes, record)
    const offset = data.getUint32(record + 8)
    const length = data.getUint32(record + 12)
    bounds(bytes, offset, length, `${name} table`)
    tables.set(name, { tag: name, offset, length })
  }
  return tables
}

export function tableBytes(bytes: Uint8Array, name: string): Uint8Array | null {
  const table = sfntTables(bytes).get(name)
  return table ? bytes.subarray(table.offset, table.offset + table.length) : null
}

export function tableInventory(bytes: Uint8Array): Readonly<Record<string, number>> {
  return Object.freeze(
    Object.fromEntries(
      [...sfntTables(bytes).values()]
        .sort((left, right) => left.tag.localeCompare(right.tag))
        .map((table) => [table.tag.trimEnd(), table.length]),
    ),
  )
}

export function colrVersion(bytes: Uint8Array): number | null {
  const colr = tableBytes(bytes, 'COLR')
  if (!colr) return null
  bounds(colr, 0, 2, 'COLR header')
  return view(colr).getUint16(0)
}

export function colrV0Layers(bytes: Uint8Array, glyphId: number): readonly ColorLayer[] | null {
  const colr = tableBytes(bytes, 'COLR')
  if (!colr || colrVersion(bytes) !== 0) return null
  bounds(colr, 0, 14, 'COLR v0 header')
  const data = view(colr)
  const baseCount = data.getUint16(2)
  const baseOffset = data.getUint32(4)
  const layerOffset = data.getUint32(8)
  const layerCount = data.getUint16(12)
  bounds(colr, baseOffset, baseCount * 6, 'COLR base glyph records')
  bounds(colr, layerOffset, layerCount * 4, 'COLR layer records')
  let low = 0
  let high = baseCount - 1
  while (low <= high) {
    const middle = (low + high) >>> 1
    const record = baseOffset + middle * 6
    const candidate = data.getUint16(record)
    if (candidate < glyphId) low = middle + 1
    else if (candidate > glyphId) high = middle - 1
    else {
      const firstLayer = data.getUint16(record + 2)
      const count = data.getUint16(record + 4)
      if (firstLayer + count > layerCount) throw new RangeError('COLR layer range is invalid')
      return Object.freeze(
        Array.from({ length: count }, (_, index) => {
          const layer = layerOffset + (firstLayer + index) * 4
          return Object.freeze({
            glyphId: data.getUint16(layer),
            paletteIndex: data.getUint16(layer + 2),
          })
        }),
      )
    }
  }
  return null
}

export function cpalPalette(bytes: Uint8Array, palette = 0): readonly RgbaColor[] | null {
  const cpal = tableBytes(bytes, 'CPAL')
  if (!cpal) return null
  bounds(cpal, 0, 12, 'CPAL header')
  const data = view(cpal)
  const version = data.getUint16(0)
  if (version > 1) throw new RangeError(`Unsupported CPAL version ${version}`)
  const entries = data.getUint16(2)
  const palettes = data.getUint16(4)
  const colorRecords = data.getUint16(6)
  const recordsOffset = data.getUint32(8)
  if (!Number.isInteger(palette) || palette < 0 || palette >= palettes) {
    throw new RangeError('palette index is unavailable')
  }
  bounds(cpal, 12, palettes * 2, 'CPAL color record indices')
  const first = data.getUint16(12 + palette * 2)
  if (first + entries > colorRecords) throw new RangeError('CPAL palette range is invalid')
  bounds(cpal, recordsOffset, colorRecords * 4, 'CPAL color records')
  return Object.freeze(
    Array.from({ length: entries }, (_, index) => {
      const record = recordsOffset + (first + index) * 4
      return Object.freeze({
        blue: data.getUint8(record),
        green: data.getUint8(record + 1),
        red: data.getUint8(record + 2),
        alpha: data.getUint8(record + 3),
      })
    }),
  )
}

export function sbixStrikes(bytes: Uint8Array): readonly SbixStrike[] {
  const sbix = tableBytes(bytes, 'sbix')
  if (!sbix) return []
  bounds(sbix, 0, 8, 'sbix header')
  const data = view(sbix)
  const count = data.getUint32(4)
  bounds(sbix, 8, count * 4, 'sbix strike offsets')
  return Object.freeze(
    Array.from({ length: count }, (_, index) => {
      const offset = data.getUint32(8 + index * 4)
      bounds(sbix, offset, 4, 'sbix strike')
      return Object.freeze({ ppem: data.getUint16(offset), resolution: data.getUint16(offset + 2) })
    }),
  )
}

export function svgDocumentRanges(bytes: Uint8Array): readonly SvgDocumentRange[] {
  const svg = tableBytes(bytes, 'SVG ')
  if (!svg) return []
  bounds(svg, 0, 10, 'SVG header')
  const data = view(svg)
  const indexOffset = data.getUint32(2)
  bounds(svg, indexOffset, 2, 'SVG document index')
  const count = data.getUint16(indexOffset)
  bounds(svg, indexOffset + 2, count * 12, 'SVG document records')
  return Object.freeze(
    Array.from({ length: count }, (_, index) => {
      const record = indexOffset + 2 + index * 12
      const documentOffset = data.getUint32(record + 4)
      const length = data.getUint32(record + 8)
      const absoluteOffset = indexOffset + documentOffset
      bounds(svg, absoluteOffset, length, 'SVG document')
      const document = svg.subarray(absoluteOffset, absoluteOffset + length)
      return Object.freeze({
        startGlyphId: data.getUint16(record),
        endGlyphId: data.getUint16(record + 2),
        compressed: document[0] === 0x1f && document[1] === 0x8b,
        byteLength: length,
      })
    }),
  )
}

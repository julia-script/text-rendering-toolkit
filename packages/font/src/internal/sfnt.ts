import { InvalidFontError } from '../errors.js'

/** Where one SFNT table lives within the font file. */
export interface SfntTableRecord {
  /** Byte offset from the start of the font file. */
  readonly offset: number
  /** Table length in bytes. */
  readonly length: number
}

/**
 * Guards every read against offsets and sizes taken from font data.
 *
 * Font tables are attacker-controllable input, so each range is checked before
 * use rather than trusting the file. `label` names the structure being read so
 * the resulting error points at the specific malformation.
 */
export function assertSfntBounds(
  bytes: Uint8Array,
  offset: number,
  size: number,
  label: string,
): void {
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(size) ||
    offset < 0 ||
    size < 0 ||
    offset + size > bytes.byteLength
  ) {
    throw new InvalidFontError(`Invalid SFNT data: ${label} exceeds its table`)
  }
}

/**
 * Wraps a `Uint8Array` in a `DataView` over the same region.
 *
 * Carries `byteOffset` across, so this stays correct for the subarray views
 * {@link sfntTable} returns rather than silently reading from the buffer start.
 */
export function sfntView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

/** Reads the table directory into a tag-keyed map of table locations. */
export function sfntTableRecords(bytes: Uint8Array): ReadonlyMap<string, SfntTableRecord> {
  assertSfntBounds(bytes, 0, 12, 'header')
  const data = sfntView(bytes)
  const count = data.getUint16(4, false)
  assertSfntBounds(bytes, 12, count * 16, 'table directory')
  const records = new Map<string, SfntTableRecord>()
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

/**
 * Returns a bounds-checked view of one table, or `null` when the font does not
 * declare it.
 *
 * Absence is normal — `post`, `OS/2`, and `COLR` are all optional — so it is
 * reported as `null`, while a declared-but-out-of-bounds table throws.
 */
export function sfntTable(
  bytes: Uint8Array,
  records: ReadonlyMap<string, SfntTableRecord>,
  name: string,
): Uint8Array | null {
  const record = records.get(name)
  if (!record) return null
  assertSfntBounds(bytes, record.offset, record.length, `${name} table`)
  return bytes.subarray(record.offset, record.offset + record.length)
}

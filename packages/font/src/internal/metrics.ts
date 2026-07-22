import type { FontDecorationMetrics } from '../types.js'
import { assertSfntBounds, sfntTable, sfntTableRecords, sfntView } from './sfnt.js'

/**
 * Reads underline and strikethrough metrics from `post` and `OS/2`, deriving
 * deterministic substitutes for whatever the font omits.
 *
 * Both tables are optional, and some fonts declare a zero or negative thickness,
 * so every field has a fallback keyed off `basis`: thickness from units-per-em,
 * underline position from the descender, strikethrough position from the
 * ascender. The result is therefore always renderable. A table that is *present*
 * but too short still throws — silence is acceptable, corruption is not.
 *
 * @param source - The full font bytes.
 * @param basis - Vertical facts already read from HarfBuzz, used to derive
 *   fallbacks for missing fields.
 */
export function readFontDecorationMetrics(
  source: ArrayBuffer,
  basis: {
    readonly unitsPerEm: number
    readonly ascender: number
    readonly descender: number
  },
): FontDecorationMetrics {
  const bytes = new Uint8Array(source)
  const records = sfntTableRecords(bytes)
  const post = sfntTable(bytes, records, 'post')
  const os2 = sfntTable(bytes, records, 'OS/2')
  const fallbackThickness = Math.max(1, Math.round(basis.unitsPerEm / 16))

  let underlinePosition = Math.round(basis.descender / 2)
  let underlineThickness = fallbackThickness
  if (post) {
    assertSfntBounds(post, 0, 12, 'post metrics')
    const data = sfntView(post)
    underlinePosition = data.getInt16(8, false)
    underlineThickness = data.getInt16(10, false)
    if (underlineThickness <= 0) underlineThickness = fallbackThickness
  }

  let strikethroughPosition = Math.round(basis.ascender * 0.3)
  let strikethroughThickness = underlineThickness
  if (os2) {
    assertSfntBounds(os2, 0, 30, 'OS/2 strikeout metrics')
    const data = sfntView(os2)
    strikethroughThickness = data.getInt16(26, false)
    strikethroughPosition = data.getInt16(28, false)
    if (strikethroughThickness <= 0) strikethroughThickness = underlineThickness
  }

  return Object.freeze({
    underlinePosition,
    underlineThickness,
    strikethroughPosition,
    strikethroughThickness,
  })
}

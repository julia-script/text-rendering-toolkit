import { readFile, writeFile } from 'node:fs/promises'
import { type FontHandle, loadFont } from '@text-rendering-toolkit/font'
import { canonicalPreparationFixtureJson, validatePreparationFixtureDocument } from './fixture.js'
import { prepareText } from './prepare.js'
import { layoutPreparedText } from './resolve.js'

const root = new URL('../../../../', import.meta.url)
const fixtureUrl = new URL('test-fixtures/preparation/fixtures.json', root)
const fontRoot = new URL('test-fixtures/fonts/harfbuzz-validation/', root)
const fontFiles = {
  latin: 'NotoSans-wdth-wght.ttf',
  arabic: 'NotoSansArabic-wdth-wght.ttf',
  devanagari: 'NotoSansDevanagari-wdth-wght.ttf',
  khmer: 'NotoSansKhmer-wdth-wght.ttf',
  symbols: 'NotoSansSymbols2-Regular.ttf',
} as const

const value: unknown = JSON.parse(await readFile(fixtureUrl, 'utf8'))
validatePreparationFixtureDocument(value)
const fonts = new Map<string, FontHandle>()
try {
  for (const [key, file] of Object.entries(fontFiles)) {
    fonts.set(key, await loadFont(new Uint8Array(await readFile(new URL(file, fontRoot)))))
  }
  const fixtures = value.fixtures.map((fixture) => {
    if (fixture.expected.error) return fixture
    const prepared = prepareText(fixture.input)
    if (fixture.classification === 'defer') {
      return { ...fixture, expected: { preparedSegments: prepared.segments } }
    }
    const completed = layoutPreparedText(prepared, fonts)
    return {
      ...fixture,
      expected: {
        preparedSegments: prepared.segments,
        resolved: {
          fontKeys: completed.layout.fontKeys,
          runRanges: completed.runs.map(({ start, end, fontKey, styleKey }) => ({
            start,
            end,
            fontKey,
            styleKey,
          })),
        },
        layout: {
          sourceLengthUtf16: completed.layout.sourceLengthUtf16,
          lineCount: completed.layout.lines.length,
          minimumGlyphCount: completed.layout.glyphs.length,
          fontKeys: completed.layout.fontKeys,
        },
      },
    }
  })
  await writeFile(fixtureUrl, canonicalPreparationFixtureJson({ ...value, fixtures }))
} finally {
  for (const font of fonts.values()) font.dispose()
}

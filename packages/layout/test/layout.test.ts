import { readFile } from 'node:fs/promises'
import {
  getSelectionRects,
  InvalidLayoutInputError,
  type LayoutFixtureDocument,
  layoutResolvedText,
  type ResolvedLayoutInput,
  validateLayoutFixtureDocument,
} from '@webgpu-text/layout'
import { describe, expect, test } from 'vitest'

const fixtureUrl = new URL('../../../test-fixtures/layout/policy-fixtures.json', import.meta.url)

async function fixtures(): Promise<LayoutFixtureDocument> {
  const value: unknown = JSON.parse(await readFile(fixtureUrl, 'utf8'))
  validateLayoutFixtureDocument(value)
  return value
}

async function input(id: string): Promise<ResolvedLayoutInput> {
  const fixture = (await fixtures()).fixtures.find((item) => item.id === id)
  if (!fixture) throw new Error(`Missing fixture: ${id}`)
  return structuredClone(fixture.input)
}

describe('resolved layout input', () => {
  test('rejects malformed input without mutating it', async () => {
    const cases: Array<(value: ResolvedLayoutInput) => void> = [
      (value) => {
        ;(value.runs[0] as { start: number }).start = 1
      },
      (value) => {
        ;(value.runs[0] as { fontKey: string }).fontKey = ''
      },
      (value) => {
        ;(value.runs[1] as { start: number }).start = 0
      },
      (value) => {
        ;(value.runs[0] as { bidiLevel: number }).bidiLevel = 1
      },
      (value) => {
        ;(value.runs[0] as { fontUnitScale: number }).fontUnitScale = 0
      },
      (value) => {
        ;(value.runs[0]?.glyphs[0] as { xAdvance: number }).xAdvance = Number.NaN
      },
      (value) => {
        ;(value.runs[0] as { glyphs: unknown[] }).glyphs = []
      },
    ]

    for (const change of cases) {
      const value = await input('runs-style-size-language')
      change(value)
      const before = structuredClone(value)
      expect(() => layoutResolvedText(value)).toThrow(InvalidLayoutInputError)
      expect(value).toEqual(before)
    }
  })

  test('rejects a boundary inside a surrogate pair', async () => {
    const value = await input('runs-fallback-grapheme')
    ;(value.runs[1]?.glyphs[0] as { start: number }).start = 2
    expect(() => layoutResolvedText(value)).toThrow('UTF-16 range')
  })
})

test('reorders nested bidi fragments without reversing shaped glyph order twice', () => {
  const metrics = { ascender: 1, descender: 0, lineGap: 0 }
  const glyph = (glyphId: number, start: number) => ({
    glyphId,
    start,
    end: start + 1,
    xAdvance: 1,
    yAdvance: 0,
    xOffset: 0,
    yOffset: 0,
    flags: 0,
    bounds: { left: 0, bottom: 0, right: 1, top: 1 },
  })
  const run = (
    start: number,
    end: number,
    direction: 'ltr' | 'rtl',
    bidiLevel: number,
    glyphs: ReturnType<typeof glyph>[],
  ) => ({
    start,
    end,
    direction,
    bidiLevel,
    script: direction === 'rtl' ? 'Hebr' : 'Latn',
    language: direction === 'rtl' ? 'he' : 'en',
    styleKey: 'default',
    fontKey: 'test',
    fontSize: 1,
    fontUnitScale: 0.001,
    metrics,
    variations: {},
    glyphs,
  })
  const value: ResolvedLayoutInput = {
    text: 'Aאב12גדB',
    paragraphLevel: 0,
    defaultMetrics: metrics,
    maxWidth: null,
    whiteSpace: 'normal',
    overflowWrap: 'normal',
    textAlign: 'left',
    textIndent: 0,
    letterSpacing: 0,
    lineHeight: 'normal',
    anchorX: 0,
    anchorY: 0,
    runs: [
      run(0, 1, 'ltr', 0, [glyph(65, 0)]),
      run(1, 3, 'rtl', 1, [glyph(1489, 2), glyph(1488, 1)]),
      run(3, 5, 'ltr', 2, [glyph(49, 3), glyph(50, 4)]),
      run(5, 7, 'rtl', 1, [glyph(1491, 6), glyph(1490, 5)]),
      run(7, 8, 'ltr', 0, [glyph(66, 7)]),
    ],
  }

  expect(layoutResolvedText(value).glyphs.map((item) => item.x)).toEqual([0, 6, 5, 3, 4, 2, 1, 7])
})

test('is deterministic and keeps input and previous results independent', async () => {
  const value = await input('runs-style-size-language')
  const before = structuredClone(value)
  const first = layoutResolvedText(value)
  const second = layoutResolvedText(value)
  expect(first).toEqual(second)
  expect(value).toEqual(before)

  ;(first.glyphs[0]?.variations as { wght?: number }).wght = 123
  expect(second.glyphs[0]?.variations).not.toEqual(first.glyphs[0]?.variations)
  expect(getSelectionRects(second, { start: 0, end: 2 })).toEqual(
    getSelectionRects(second, { start: 2, end: 0 }),
  )
})

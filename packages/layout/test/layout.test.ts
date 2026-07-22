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

function monospaceInput(
  text: string,
  overrides: Partial<ResolvedLayoutInput> = {},
): ResolvedLayoutInput {
  const metrics = { ascender: 1, descender: 0, lineGap: 0 }
  const glyphs = [...new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(text)]
    .filter(({ segment }) => !/[\n\v\f\r\u0085\u2028\u2029]/u.test(segment))
    .map(({ index: start, segment }, glyphId) => ({
      glyphId,
      start,
      end: start + segment.length,
      xAdvance: 1,
      yAdvance: 0,
      xOffset: 0,
      yOffset: 0,
      flags: 0,
      bounds: null,
    }))
  return {
    text,
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
    runs:
      text.length === 0
        ? []
        : [
            {
              start: 0,
              end: text.length,
              direction: 'ltr',
              bidiLevel: 0,
              script: 'Latn',
              language: 'und',
              styleKey: 'default',
              fontKey: 'test',
              fontSize: 1,
              fontUnitScale: 1,
              metrics,
              variations: {},
              glyphs,
            },
          ],
    ...overrides,
  }
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

  test('rejects malformed explicit opportunities and shaped-cluster splits', () => {
    const valid = monospaceInput('áb', {
      breakOpportunities: [
        { position: 2, required: false },
        { position: 3, required: false },
      ],
    })
    expect(() =>
      layoutResolvedText({
        ...valid,
        breakOpportunities: [
          { position: 1, required: false },
          { position: 3, required: false },
        ],
      }),
    ).toThrow('grapheme boundary')
    expect(() =>
      layoutResolvedText({
        ...valid,
        breakOpportunities: [
          { position: 2, required: false },
          { position: 2, required: false },
          { position: 3, required: false },
        ],
      }),
    ).toThrow('ordered and unique')
    expect(() => layoutResolvedText({ ...valid, breakOpportunities: [] })).toThrow(
      'terminal boundary',
    )

    const mergedCluster = monospaceInput('ab', {
      breakOpportunities: [
        { position: 1, required: false },
        { position: 2, required: false },
      ],
    })
    ;(mergedCluster.runs[0] as { glyphs: unknown[] }).glyphs = [
      {
        glyphId: 0,
        start: 0,
        end: 2,
        xAdvance: 2,
        yAdvance: 0,
        xOffset: 0,
        yOffset: 0,
        flags: 0,
        bounds: null,
      },
    ]
    expect(() => layoutResolvedText(mergedCluster)).toThrow('splits a shaped cluster')
  })
})

describe('explicit resolved line-break policy', () => {
  test('wraps punctuation and CJK at the last supplied opportunity that fits', () => {
    const punctuation = layoutResolvedText(
      monospaceInput('ab,cd', {
        maxWidth: 3,
        breakOpportunities: [
          { position: 3, required: false },
          { position: 5, required: false },
        ],
      }),
    )
    expect(punctuation.lines.map(({ end, breakAfter }) => ({ end, breakAfter }))).toEqual([
      { end: 3, breakAfter: 'soft' },
      { end: 5, breakAfter: 'none' },
    ])

    const cjk = layoutResolvedText(
      monospaceInput('你好世界', {
        maxWidth: 2.5,
        letterSpacing: 0.5,
        breakOpportunities: [1, 2, 3, 4].map((position) => ({
          position,
          required: false,
        })),
      }),
    )
    expect(cjk.lines.map(({ end }) => end)).toEqual([2, 4])
  })

  test('keeps trailing wrap whitespace logical but excludes it from measured width', () => {
    const result = layoutResolvedText(
      monospaceInput('ab cd', {
        maxWidth: 2,
        breakOpportunities: [
          { position: 3, required: false },
          { position: 5, required: false },
        ],
      }),
    )
    expect(result.lines[0]).toMatchObject({ end: 3, right: 2, breakAfter: 'soft' })
  })

  test('honors mandatory controls under nowrap while suppressing optional wrapping', () => {
    const required = layoutResolvedText(
      monospaceInput('ab\u2028cd', {
        maxWidth: 1,
        whiteSpace: 'nowrap',
        breakOpportunities: [
          { position: 3, required: true },
          { position: 5, required: false },
        ],
      }),
    )
    expect(required.lines.map(({ end, breakAfter }) => ({ end, breakAfter }))).toEqual([
      { end: 3, breakAfter: 'hard' },
      { end: 5, breakAfter: 'none' },
    ])

    const optional = layoutResolvedText(
      monospaceInput('abcd', {
        maxWidth: 2,
        whiteSpace: 'nowrap',
        breakOpportunities: [
          { position: 2, required: false },
          { position: 4, required: false },
        ],
      }),
    )
    expect(optional.lines).toHaveLength(1)
  })

  test('uses grapheme-safe emergency wrapping when no explicit opportunity fits', () => {
    const value = monospaceInput('abcd', {
      maxWidth: 1,
      overflowWrap: 'break-word',
      breakOpportunities: [{ position: 4, required: false }],
    })
    const first = layoutResolvedText(value)
    expect(first.lines.map(({ end }) => end)).toEqual([1, 2, 3, 4])
    expect(first).toEqual(layoutResolvedText(value))
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

  const wrapped = layoutResolvedText({
    ...value,
    maxWidth: 4,
    breakOpportunities: [
      { position: 3, required: false },
      { position: 5, required: false },
      { position: 8, required: false },
    ],
  })
  expect(wrapped.lines.map(({ end }) => end)).toEqual([3, 5, 8])
  expect(new Set(wrapped.glyphs.map(({ lineIndex }) => lineIndex))).toEqual(new Set([0, 1, 2]))
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

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import {
  type FontHandle,
  loadFont,
  type ShapedRun,
  type ShapeInput,
} from '@text-rendering-toolkit/font'
import {
  type FontRegistry,
  getSelectionRects,
  type LineBreakOpportunity,
  layoutPreparedText,
  layoutText,
  type PreparedSegment,
  type PreparedText,
  type PrepareTextInput,
  prepareText,
  TextPreparationError,
} from '@text-rendering-toolkit/layout'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

interface ExpectedError {
  readonly code: 'invalid-input' | 'missing-font' | 'missing-coverage'
  readonly start?: number
  readonly end?: number
  readonly attemptedFontKeys?: readonly string[]
}

interface PreparationFixture {
  readonly id: string
  readonly tags: readonly string[]
  readonly classification: 'preserve' | 'intentional-change' | 'defer'
  readonly input: PrepareTextInput
  readonly expected: {
    readonly preparedSegments?: readonly PreparedSegment[]
    readonly preparedBreakOpportunities?: readonly LineBreakOpportunity[]
    readonly resolved?: {
      readonly fontKeys: readonly string[]
      readonly runRanges: readonly {
        readonly start: number
        readonly end: number
        readonly fontKey: string
        readonly styleKey: string
      }[]
    }
    readonly layout?: {
      readonly sourceLengthUtf16: number
      readonly lineCount: number
      readonly minimumGlyphCount: number
      readonly fontKeys: readonly string[]
    }
    readonly error?: ExpectedError
  }
}

interface PreparationDocument {
  readonly schemaVersion: 1
  readonly unicodeVersion: string
  readonly bidiRevision: string
  readonly lineBreakRevision: string
  readonly fontManifest: { readonly file: string; readonly sha256: string }
  readonly fixtures: readonly PreparationFixture[]
}

const root = new URL('../../../', import.meta.url)
const fixtureUrl = new URL('test-fixtures/preparation/fixtures.json', root)
const fontRoot = new URL('test-fixtures/fonts/harfbuzz-validation/', root)
const fontManifestUrl = new URL('fixtures.json', fontRoot)
const fontFiles = {
  latin: 'NotoSans-wdth-wght.ttf',
  arabic: 'NotoSansArabic-wdth-wght.ttf',
  devanagari: 'NotoSansDevanagari-wdth-wght.ttf',
  khmer: 'NotoSansKhmer-wdth-wght.ttf',
  symbols: 'NotoSansSymbols2-Regular.ttf',
} as const

let source = ''
let document: PreparationDocument
const handles = new Map<string, FontHandle>()
const testSegmenter = new Intl.Segmenter('und', { granularity: 'grapheme' })

beforeAll(async () => {
  source = await readFile(fixtureUrl, 'utf8')
  document = JSON.parse(source) as PreparationDocument
  for (const [key, file] of Object.entries(fontFiles)) {
    handles.set(key, await loadFont(new Uint8Array(await readFile(new URL(file, fontRoot)))))
  }
})

afterAll(() => {
  for (const handle of handles.values()) handle.dispose()
})

function fixture(id: string): PreparationFixture {
  const value = document.fixtures.find((item) => item.id === id)
  if (!value) throw new Error(`Missing fixture ${id}`)
  return value
}

function expectedError(item: PreparationFixture): TextPreparationError {
  try {
    layoutText(item.input, handles)
  } catch (error) {
    if (error instanceof TextPreparationError) return error
    throw error
  }
  throw new Error(`Fixture ${item.id} did not fail`)
}

function graphemeFont(shapeCalls: ShapeInput[] = []): FontHandle {
  return {
    facts: {
      unitsPerEm: 1_000,
      ascender: 800,
      descender: -200,
      lineGap: 0,
      decorationMetrics: {
        underlinePosition: -100,
        underlineThickness: 50,
        strikethroughPosition: 300,
        strikethroughThickness: 50,
      },
      coverageCount: 1,
      axes: [],
    },
    supports: () => true,
    shape: (input): ShapedRun => {
      shapeCalls.push(structuredClone(input))
      return {
        glyphs: [...testSegmenter.segment(input.text)].map((segment, glyphId) => ({
          glyphId,
          clusterStart: segment.index,
          clusterEnd: segment.index + segment.segment.length,
          sourceText: segment.segment,
          xAdvance: 1_000,
          yAdvance: 0,
          xOffset: 0,
          yOffset: 0,
          flags: 0,
        })),
        textLengthUtf16: input.text.length,
        direction: input.direction,
        script: input.script,
        language: input.language,
        variations: { ...(input.variations ?? {}) },
      }
    },
    getOutline: () => {
      throw new Error('outline access is not allowed')
    },
    getColorLayers: () => null,
    dispose: () => {
      throw new Error('caller font disposal is not allowed')
    },
  }
}

describe('canonical production preparation', () => {
  test('pins canonical JSON, Unicode revisions, fonts, and required cases', async () => {
    expect(`${JSON.stringify(JSON.parse(source), null, 2)}\n`).toBe(source)
    expect(document.schemaVersion).toBe(1)
    expect(document.unicodeVersion).toBe('17.0.0')
    expect(document.bidiRevision).toBe('bidi-js@1.0.3 / Unicode 13.0.0')
    expect(document.lineBreakRevision).toBe('linebreak@1.1.0 / Unicode 13.0.0')
    const manifest = await readFile(fontManifestUrl)
    expect(createHash('sha256').update(manifest).digest('hex')).toBe(document.fontManifest.sha256)
    const tags = new Set(document.fixtures.flatMap((item) => item.tags))
    for (const tag of [
      'latin',
      'arabic',
      'devanagari',
      'khmer',
      'mixed-bidi',
      'common',
      'inherited',
      'combining',
      'supplementary',
      'style',
      'fallback',
      'empty',
      'coverage',
      'joiner',
      'variation-selector',
    ]) {
      expect(tags.has(tag), tag).toBe(true)
    }
  })

  test('matches every accepted prepared segment', () => {
    for (const item of document.fixtures) {
      if (item.expected.error?.code === 'invalid-input') continue
      const before = structuredClone(item.input)
      const first = prepareText(item.input)
      expect(first, item.id).toEqual(prepareText(item.input))
      expect(first.schemaVersion, item.id).toBe(2)
      expect(item.input, item.id).toEqual(before)
      expect(JSON.parse(JSON.stringify(first)), item.id).toEqual(first)
      if (item.expected.preparedSegments) {
        expect(first.segments, item.id).toEqual(item.expected.preparedSegments)
      }
      if (item.expected.preparedBreakOpportunities) {
        expect(first.breakOpportunities, item.id).toEqual(item.expected.preparedBreakOpportunities)
      }
    }
  })

  test('preserves scalar, grapheme, control, break, and style boundaries', () => {
    expect(prepareText(fixture('supplementary-fallback').input).segments.at(-1)).toMatchObject({
      start: 1,
      end: 3,
    })
    const joiner = prepareText(fixture('joiner-variation-boundary').input)
    expect(joiner.segments).toHaveLength(1)
    expect(joiner.segments[0]).toMatchObject({ start: 0, end: 5 })
    const hardBreak = prepareText(fixture('hard-break-paragraphs').input)
    expect(hardBreak.segments.some((segment) => segment.start <= 5 && segment.end > 5)).toBe(false)
    expect(
      prepareText(fixture('bidi-controls').input).segments.map((item) => item.bidiLevel),
    ).toEqual([0, 1, 0])
    expect(() => prepareText(fixture('invalid-grapheme-style-boundary').input)).toThrow(
      'grapheme boundaries',
    )
  })

  test('records normalized Unicode opportunities without splitting editable graphemes', () => {
    expect(prepareText(fixture('latin-ligature').input).breakOpportunities).toEqual([
      { position: 7, required: false },
      { position: 11, required: false },
    ])
    expect(prepareText(fixture('hard-break-paragraphs').input).breakOpportunities).toContainEqual({
      position: 6,
      required: true,
    })
    const joiner = prepareText(fixture('joiner-variation-boundary').input)
    const boundaries = new Set(
      [...new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(joiner.text)].flatMap(
        (segment) => [segment.index, segment.index + segment.segment.length],
      ),
    )
    expect(joiner.breakOpportunities.every(({ position }) => boundaries.has(position))).toBe(true)
  })
})

describe('public font-aware composition', () => {
  test('lays out every supported canonical case through both public paths', () => {
    for (const item of document.fixtures) {
      if (item.expected.error || item.classification === 'defer') continue
      const prepared = prepareText(item.input)
      const first = layoutPreparedText(prepared, handles)
      expect(first, item.id).toEqual(
        layoutPreparedText(JSON.parse(JSON.stringify(prepared)) as PreparedText, new Map(handles)),
      )
      expect(first, item.id).toEqual(layoutText(item.input, handles))
      expect(first.sourceLengthUtf16, item.id).toBe(item.input.text.length)
      expect(first.lines.length, item.id).toBeGreaterThan(0)
      expect(first.visibleBounds, item.id).toBeNull()
      expect(
        first.glyphs.every((glyph) => glyph.fontUnitScale > 0),
        item.id,
      ).toBe(true)
      expect(
        first.glyphs.every((glyph) => Number.isFinite(glyph.xAdvance)),
        item.id,
      ).toBe(true)
      expect(
        getSelectionRects(first, { start: 0, end: item.input.text.length }),
        item.id,
      ).toBeDefined()

      if (item.expected.resolved) {
        expect(first.fontKeys, item.id).toEqual(item.expected.resolved.fontKeys)
        for (const expected of item.expected.resolved.runRanges) {
          expect(
            first.glyphs.some(
              (glyph) =>
                glyph.start >= expected.start &&
                glyph.end <= expected.end &&
                glyph.fontKey === expected.fontKey &&
                glyph.styleKey === expected.styleKey,
            ),
            `${item.id}:${expected.start}-${expected.end}`,
          ).toBe(true)
        }
      }
      if (item.expected.layout) {
        expect(first.sourceLengthUtf16, item.id).toBe(item.expected.layout.sourceLengthUtf16)
        expect(first.lines.length, item.id).toBe(item.expected.layout.lineCount)
        expect(first.glyphs.length, item.id).toBeGreaterThanOrEqual(
          item.expected.layout.minimumGlyphCount,
        )
        expect(first.fontKeys, item.id).toEqual(item.expected.layout.fontKeys)
      }
    }
  })

  test('reports canonical invalid input, missing keys, and missing coverage', () => {
    for (const item of document.fixtures.filter((value) => value.expected.error)) {
      const expected = item.expected.error
      if (!expected) continue
      const error = expectedError(item)
      expect(error.code, item.id).toBe(expected.code)
      expect(error.start, item.id).toBe(expected.start)
      expect(error.end, item.id).toBe(expected.end)
      expect(error.attemptedFontKeys, item.id).toEqual(expected.attemptedFontKeys ?? [])
    }
  })

  test('revalidates parsed values and deeply freezes produced values', () => {
    const prepared = prepareText(fixture('mixed-bidi-fallback').input)
    expect(Object.isFrozen(prepared)).toBe(true)
    expect(Object.isFrozen(prepared.defaultStyle)).toBe(true)
    expect(Object.isFrozen(prepared.defaultStyle.fontKeys)).toBe(true)
    expect(Object.isFrozen(prepared.layout)).toBe(true)
    expect(Object.isFrozen(prepared.segments)).toBe(true)
    expect(prepared.segments.every(Object.isFrozen)).toBe(true)
    expect(Object.isFrozen(prepared.breakOpportunities)).toBe(true)
    expect(prepared.breakOpportunities.every(Object.isFrozen)).toBe(true)

    const parsed = JSON.parse(JSON.stringify(prepared)) as PreparedText
    ;(parsed as { schemaVersion: number }).schemaVersion = 1
    expect(() => layoutPreparedText(parsed, handles)).toThrow('schemaVersion must be 2')
    expect(() =>
      layoutPreparedText(
        {
          ...prepared,
          layout: { ...prepared.layout, anchorX: 'sideways' as never },
        },
        handles,
      ),
    ).toThrow('layout.anchorX is invalid')
    expect(() =>
      layoutPreparedText({ ...prepared, paragraphDirection: undefined } as never, handles),
    ).toThrow('paragraphDirection is required')
    expect(() =>
      layoutPreparedText(
        { ...prepared, segments: [{ ...prepared.segments[0], start: 1 }] } as PreparedText,
        handles,
      ),
    ).toThrow()
  })

  test('rejects malformed, incomplete, and source-inconsistent prepared opportunities', () => {
    const prepared = prepareText(fixture('latin-ligature').input)
    const invalid = (breakOpportunities: readonly LineBreakOpportunity[]) =>
      layoutPreparedText({ ...prepared, breakOpportunities }, handles)

    expect(() => invalid(prepared.breakOpportunities.slice(0, -1))).toThrow('one terminal boundary')
    expect(() =>
      invalid([
        prepared.breakOpportunities[0] as LineBreakOpportunity,
        prepared.breakOpportunities[0] as LineBreakOpportunity,
        ...prepared.breakOpportunities.slice(1),
      ]),
    ).toThrow('ordered and unique')

    const supplementary = prepareText(fixture('supplementary-fallback').input)
    expect(() =>
      layoutPreparedText(
        {
          ...supplementary,
          breakOpportunities: [
            { position: 2, required: false },
            ...supplementary.breakOpportunities,
          ],
        },
        handles,
      ),
    ).toThrow('grapheme boundary')

    const hardBreak = prepareText(fixture('hard-break-paragraphs').input)
    const requiredIndex = hardBreak.breakOpportunities.findIndex(({ required }) => required)
    expect(requiredIndex).toBeGreaterThanOrEqual(0)
    expect(() =>
      layoutPreparedText(
        {
          ...hardBreak,
          breakOpportunities: hardBreak.breakOpportunities.map((opportunity, index) =>
            index === requiredIndex ? { ...opportunity, required: false } : opportunity,
          ),
        },
        handles,
      ),
    ).toThrow('does not match the source control')
  })

  test('never extracts outlines or assumes ownership of font handles', () => {
    const item = fixture('latin-ligature')
    const latin = handles.get('latin')
    if (!latin) throw new Error('Missing Latin handle')
    const noOutline: FontHandle = {
      facts: latin.facts,
      supports: (codePoint) => latin.supports(codePoint),
      shape: (input) => latin.shape(input),
      getOutline: () => {
        throw new Error('outline access is not allowed')
      },
      getColorLayers: () => null,
      dispose: () => {
        throw new Error('caller font disposal is not allowed')
      },
    }
    expect(layoutText(item.input, new Map([['latin', noOutline]])).glyphs.length).toBeGreaterThan(0)
    expect(latin.supports('A'.codePointAt(0) as number)).toBe(true)
  })

  test('requires every named key even when an earlier font covers the text', () => {
    const prepared = prepareText({
      text: '',
      style: {
        key: 'default',
        fontKeys: ['latin', 'missing'],
        fontSize: 24,
        language: 'und',
      },
    })
    expect(() => layoutPreparedText(prepared, handles as FontRegistry)).toThrow(
      'font registry has no key missing',
    )
  })

  test('selects exact CJK and punctuation boundaries with call-local shape reuse', () => {
    const calls: ShapeInput[] = []
    const fonts = new Map([['all', graphemeFont(calls)]])
    const input: PrepareTextInput = {
      text: '你好世界',
      style: { key: 'default', fontKeys: ['all'], fontSize: 1, language: 'zh' },
      layout: { maxWidth: 2 },
    }
    const first = layoutText(input, fonts)
    expect(first.lines.map(({ end }) => end)).toEqual([2, 4])
    expect(calls.filter(({ text }) => text === '你好')).toHaveLength(1)
    expect(calls.filter(({ text }) => text === '世界')).toHaveLength(1)
    expect(first).toEqual(layoutText(input, new Map([['all', graphemeFont()]])))

    const punctuation = layoutText(
      {
        text: 'one/two',
        style: { key: 'default', fontKeys: ['all'], fontSize: 1, language: 'en' },
        layout: { maxWidth: 4 },
      },
      fonts,
    )
    expect(punctuation.lines.map(({ end }) => end)).toEqual([4, 7])
  })

  test('keeps emoji sequences intact during emergency wrapping', () => {
    const text = '👩‍👩‍👧‍👦🇧🇷X'
    const result = layoutText(
      {
        text,
        style: { key: 'default', fontKeys: ['all'], fontSize: 1, language: 'und' },
        layout: { maxWidth: 1, overflowWrap: 'break-word' },
      },
      new Map([['all', graphemeFont()]]),
    )
    const boundaries = new Set(
      [...testSegmenter.segment(text)].flatMap((segment) => [
        segment.index,
        segment.index + segment.segment.length,
      ]),
    )
    expect(result.lines.map(({ end }) => end)).toEqual([11, 15, 16])
    expect(
      result.glyphs.every(({ start, end }) => boundaries.has(start) && boundaries.has(end)),
    ).toBe(true)
  })

  test('reshapes actual Arabic line fragments through the public font API', () => {
    const arabic = handles.get('arabic')
    if (!arabic) throw new Error('Missing Arabic handle')
    const calls: string[] = []
    const observed: FontHandle = {
      facts: arabic.facts,
      supports: (codePoint) => arabic.supports(codePoint),
      shape: (input) => {
        calls.push(input.text)
        return arabic.shape(input)
      },
      getOutline: () => {
        throw new Error('outline access is not allowed')
      },
      getColorLayers: () => null,
      dispose: () => {
        throw new Error('caller font disposal is not allowed')
      },
    }
    const result = layoutText(
      {
        text: 'مرحبا بالعالم',
        style: { key: 'arabic', fontKeys: ['arabic'], fontSize: 24, language: 'ar' },
        layout: { maxWidth: 60 },
      },
      new Map([['arabic', observed]]),
    )
    expect(result.lines.map(({ end }) => end)).toEqual([6, 13])
    expect(calls).toContain('مرحبا ')
    expect(calls).toContain('بالعالم')
    expect(calls.filter((text) => text === 'مرحبا ')).toHaveLength(1)
    expect(calls.filter((text) => text === 'بالعالم')).toHaveLength(1)
    expect(result.glyphs.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))).toBe(true)
  })

  test('places mixed-direction fragments independently on wrapped lines', () => {
    const result = layoutText(
      {
        text: 'Hello مرحبا',
        style: {
          key: 'default',
          fontKeys: ['latin', 'arabic'],
          fontSize: 24,
          language: 'und',
        },
        layout: { maxWidth: 60 },
      },
      handles,
    )
    expect(result.lines.map(({ end }) => end)).toEqual([6, 11])
    const arabicGlyphs = result.glyphs.filter(({ lineIndex }) => lineIndex === 1)
    expect(arabicGlyphs.length).toBeGreaterThan(0)
    expect(arabicGlyphs[0]?.x).toBeGreaterThan(arabicGlyphs.at(-1)?.x ?? Number.POSITIVE_INFINITY)
    expect(getSelectionRects(result, { start: 0, end: 11 })).toHaveLength(2)
  })
})

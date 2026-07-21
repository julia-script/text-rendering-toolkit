import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { type FontHandle, loadFont } from '@webgpu-text/font'
import {
  type FontRegistry,
  getSelectionRects,
  layoutPreparedText,
  layoutText,
  type PreparedSegment,
  type PreparedText,
  type PrepareTextInput,
  prepareText,
  TextPreparationError,
} from '@webgpu-text/layout'
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

describe('canonical production preparation', () => {
  test('pins canonical JSON, Unicode revisions, fonts, and required cases', async () => {
    expect(`${JSON.stringify(JSON.parse(source), null, 2)}\n`).toBe(source)
    expect(document.schemaVersion).toBe(1)
    expect(document.unicodeVersion).toBe('17.0.0')
    expect(document.bidiRevision).toBe('bidi-js@1.0.3 / Unicode 13.0.0')
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
      expect(item.input, item.id).toEqual(before)
      expect(JSON.parse(JSON.stringify(first)), item.id).toEqual(first)
      if (item.expected.preparedSegments) {
        expect(first.segments, item.id).toEqual(item.expected.preparedSegments)
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

    const parsed = JSON.parse(JSON.stringify(prepared)) as PreparedText
    ;(parsed as { schemaVersion: number }).schemaVersion = 2
    expect(() => layoutPreparedText(parsed, handles)).toThrow('schemaVersion must be 1')
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
})

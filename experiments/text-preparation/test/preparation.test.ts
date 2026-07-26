import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { type FontHandle, loadFont } from '@text-rendering-toolkit/font'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { PreparationError } from '../src/errors.js'
import {
  canonicalPreparationFixtureJson,
  validatePreparationFixtureDocument,
} from '../src/fixture.js'
import { prepareText } from '../src/prepare.js'
import { layoutPreparedText, layoutText, selectionFor } from '../src/resolve.js'
import type { FontRegistry, PreparationFixture, PreparationFixtureDocument } from '../src/types.js'

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
let document: PreparationFixtureDocument
const handles = new Map<string, FontHandle>()

beforeAll(async () => {
  source = await readFile(fixtureUrl, 'utf8')
  const value: unknown = JSON.parse(source)
  validatePreparationFixtureDocument(value)
  document = value
  for (const [key, file] of Object.entries(fontFiles)) {
    handles.set(key, await loadFont(new Uint8Array(await readFile(new URL(file, fontRoot)))))
  }
})

afterAll(() => {
  for (const handle of handles.values()) handle.dispose()
})

function expectedError(fixture: PreparationFixture): PreparationError {
  try {
    const prepared = prepareText(fixture.input)
    layoutPreparedText(prepared, handles)
  } catch (error) {
    if (error instanceof PreparationError) return error
    throw error
  }
  throw new Error(`Fixture ${fixture.id} did not fail`)
}

describe('canonical preparation evidence', () => {
  test('validates and regenerates canonical JSON deterministically', async () => {
    const canonical = canonicalPreparationFixtureJson(document)
    expect(canonical).toBe(source)
    expect(canonicalPreparationFixtureJson(JSON.parse(canonical))).toBe(canonical)
    const manifest = await readFile(fontManifestUrl)
    expect(createHash('sha256').update(manifest).digest('hex')).toBe(document.fontManifest.sha256)
  })

  test('records every required evidence class', () => {
    const tags = new Set(document.fixtures.flatMap((fixture) => fixture.tags))
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

  test('promotes candidate dependencies only into the layout package', async () => {
    for (const name of ['font', 'layout', 'sdf', 'three']) {
      const manifest = JSON.parse(
        await readFile(new URL(`packages/${name}/package.json`, root), 'utf8'),
      ) as { readonly dependencies?: Readonly<Record<string, string>>; readonly exports?: unknown }
      expect(manifest.exports, name).toBeDefined()
      const dependencies = Object.keys(manifest.dependencies ?? {})
      expect(dependencies.includes('bidi-js'), name).toBe(name === 'layout')
      expect(dependencies.includes('unicode-script'), name).toBe(name === 'layout')
    }
  })
})

describe('font-independent preparation', () => {
  test('is immutable, serializable, deterministic, and matches accepted segments', () => {
    for (const fixture of document.fixtures) {
      if (fixture.expected.error?.code === 'invalid-input') continue
      const before = structuredClone(fixture.input)
      const first = prepareText(fixture.input)
      const second = prepareText(fixture.input)
      expect(first, fixture.id).toEqual(second)
      expect(fixture.input, fixture.id).toEqual(before)
      expect(JSON.parse(JSON.stringify(first)), fixture.id).toEqual(first)
      expect(Object.isFrozen(first), fixture.id).toBe(true)
      expect(Object.isFrozen(first.segments), fixture.id).toBe(true)
      if (fixture.expected.preparedSegments) {
        expect(first.segments, fixture.id).toEqual(fixture.expected.preparedSegments)
      }
    }
  })

  test('never splits UTF-16 scalars, graphemes, controls, hard breaks, or style boundaries', () => {
    const byId = new Map(document.fixtures.map((fixture) => [fixture.id, fixture]))
    const supplementary = prepareText(byId.get('supplementary-fallback')?.input as never)
    expect(supplementary.segments.at(-1)).toMatchObject({ start: 1, end: 3 })
    const joiner = prepareText(byId.get('joiner-variation-boundary')?.input as never)
    expect(joiner.segments).toHaveLength(1)
    expect(joiner.segments[0]).toMatchObject({ start: 0, end: 5 })
    const hardBreak = prepareText(byId.get('hard-break-paragraphs')?.input as never)
    expect(hardBreak.segments.some((segment) => segment.start <= 5 && segment.end > 5)).toBe(false)
    const controls = prepareText(byId.get('bidi-controls')?.input as never)
    expect(controls.segments.map((segment) => segment.bidiLevel)).toEqual([0, 1, 0])
    const invalid = byId.get('invalid-grapheme-style-boundary')
    if (!invalid) throw new Error('Missing invalid boundary fixture')
    expect(() => prepareText(invalid.input)).toThrow('grapheme boundaries')
  })
})

describe('explicit-font resolution and layout composition', () => {
  test('resolves, shapes, scales, lays out, and selects through public APIs', () => {
    for (const fixture of document.fixtures) {
      if (fixture.expected.error || fixture.classification === 'defer') continue
      const prepared = prepareText(fixture.input)
      const first = layoutPreparedText(prepared, handles)
      const second = layoutPreparedText(prepared, new Map(handles))
      const oneCall = layoutText(fixture.input, handles)
      expect(first, fixture.id).toEqual(second)
      expect(first, fixture.id).toEqual(oneCall)
      expect(first.layout.sourceLengthUtf16, fixture.id).toBe(fixture.input.text.length)
      expect(first.layout.lines.length, fixture.id).toBeGreaterThan(0)
      expect(
        first.runs.every((run) => run.fontUnitScale > 0),
        fixture.id,
      ).toBe(true)
      expect(
        first.runs.every((run) => run.glyphs.every((glyph) => Number.isFinite(glyph.xAdvance))),
      ).toBe(true)
      expect(selectionFor(first, 0, fixture.input.text.length), fixture.id).toBeDefined()
      if (fixture.expected.resolved) {
        expect(first.layout.fontKeys, fixture.id).toEqual(fixture.expected.resolved.fontKeys)
        expect(
          first.runs.map(({ start, end, fontKey, styleKey }) => ({
            start,
            end,
            fontKey,
            styleKey,
          })),
          fixture.id,
        ).toEqual(fixture.expected.resolved.runRanges)
      }
      if (fixture.expected.layout) {
        expect(first.layout.sourceLengthUtf16, fixture.id).toBe(
          fixture.expected.layout.sourceLengthUtf16,
        )
        expect(first.layout.lines.length, fixture.id).toBe(fixture.expected.layout.lineCount)
        expect(first.layout.glyphs.length, fixture.id).toBeGreaterThanOrEqual(
          fixture.expected.layout.minimumGlyphCount,
        )
        expect(first.layout.fontKeys, fixture.id).toEqual(fixture.expected.layout.fontKeys)
      }
    }
  })

  test('reports missing keys and cluster-wide coverage without fetching', () => {
    for (const fixture of document.fixtures.filter((item) => item.expected.error)) {
      const expected = fixture.expected.error
      if (!expected) continue
      const error = expectedError(fixture)
      expect(error.code, fixture.id).toBe(expected.code)
      expect(error.start, fixture.id).toBe(expected.start)
      expect(error.end, fixture.id).toBe(expected.end)
      expect(error.attemptedFontKeys, fixture.id).toEqual(expected.attemptedFontKeys ?? [])
    }
    const emptyWithMissingSecondary = prepareText({
      text: '',
      style: {
        key: 'default',
        fontKeys: ['latin', 'missing'],
        fontSize: 24,
        language: 'und',
      },
    })
    expect(() => layoutPreparedText(emptyWithMissingSecondary, handles)).toThrow(
      'font registry has no key missing',
    )
  })

  test('does not dispose, mutate, or globally cache caller-owned handles', () => {
    const fixture = document.fixtures.find((item) => item.id === 'mixed-bidi-fallback')
    if (!fixture) throw new Error('Missing mixed fixture')
    const latin = handles.get('latin')
    if (!latin) throw new Error('Missing Latin handle')
    const before = latin.facts
    layoutText(fixture.input, handles as FontRegistry)
    expect(latin.facts).toBe(before)
    expect(latin.supports('A'.codePointAt(0) as number)).toBe(true)
  })
})

import { readFile } from 'node:fs/promises'
import {
  canonicalFixtureJson,
  deriveSelectionRects,
  getSelectionRects,
  type LayoutFixtureDocument,
  layoutResolvedText,
  validateLayoutFixtureDocument,
} from '@text-rendering-toolkit/layout'
import { describe, expect, test } from 'vitest'

const fixtureUrl = new URL('../../../test-fixtures/layout/policy-fixtures.json', import.meta.url)

async function loadFixtures(): Promise<LayoutFixtureDocument> {
  const value: unknown = JSON.parse(await readFile(fixtureUrl, 'utf8'))
  validateLayoutFixtureDocument(value)
  return value
}

describe('layout policy fixture contract', () => {
  test('validates every focused synthetic case', async () => {
    const document = await loadFixtures()
    expect(document.fixtures).toHaveLength(19)
    expect(new Set(document.fixtures.map((fixture) => fixture.id)).size).toBe(19)
  })

  test('runs every accepted case through the production layout core', async () => {
    const document = await loadFixtures()
    for (const fixture of document.fixtures) {
      expect(layoutResolvedText(fixture.input), fixture.id).toEqual(fixture.expected)
    }
  })

  test('canonicalizes numbers and object keys deterministically', () => {
    const value = { z: -0, a: 1.23456789, nested: { y: 2, x: 1 } }
    const first = canonicalFixtureJson(value, 6)
    expect(first).toBe(canonicalFixtureJson(JSON.parse(first), 6))
    expect(first).toContain('1.234568')
    expect(first).not.toContain('-0')
    expect(() => canonicalFixtureJson({ value: Number.NaN })).toThrow('non-finite')
  })

  test('rejects invalid boundaries, higher-layer fields, and incomplete evidence', async () => {
    const document = await loadFixtures()

    const splitSurrogate = structuredClone(document) as unknown as {
      fixtures: Array<{ expected: { carets: Array<{ offset: number }> } }>
    }
    const fallback = splitSurrogate.fixtures.find(
      (fixture) => (fixture as unknown as { id: string }).id === 'runs-fallback-grapheme',
    )
    if (!fallback) throw new Error('Missing fallback fixture')
    fallback.expected.carets[2] = { ...fallback.expected.carets[2], offset: 2 }
    expect(() => validateLayoutFixtureDocument(splitSurrogate)).toThrow('UTF-16 boundaries')

    const higherLayer = structuredClone(document) as unknown as {
      fixtures: Array<Record<string, unknown>>
    }
    higherLayer.fixtures[0] = { ...higherLayer.fixtures[0], atlasSlot: 1 }
    expect(() => validateLayoutFixtureDocument(higherLayer)).toThrow('forbidden higher-layer')

    const incomplete = structuredClone(document) as unknown as {
      fixtures: Array<Record<string, unknown>>
    }
    incomplete.fixtures[0] = { ...incomplete.fixtures[0], rationale: '' }
    expect(() => validateLayoutFixtureDocument(incomplete)).toThrow('rationale')
  })

  test('derives every committed selection from caret and line data', async () => {
    const document = await loadFixtures()
    for (const fixture of document.fixtures) {
      for (const selection of fixture.selections) {
        expect(
          deriveSelectionRects(fixture.expected, selection.query.start, selection.query.end),
          `${fixture.id} ${selection.query.start}:${selection.query.end}`,
        ).toEqual(selection.rects)
        expect(getSelectionRects(fixture.expected, selection.query)).toEqual(selection.rects)
      }
    }
  })

  test('keeps selection rectangles finite, ordered, and non-overlapping', async () => {
    const document = await loadFixtures()
    for (const fixture of document.fixtures) {
      for (const selection of fixture.selections) {
        let previousLine = -1
        let previousRight = -Infinity
        for (const rect of selection.rects) {
          expect(Object.values(rect).every(Number.isFinite)).toBe(true)
          expect(rect.lineIndex).toBeGreaterThanOrEqual(previousLine)
          if (rect.lineIndex === previousLine) expect(rect.left).toBeGreaterThan(previousRight)
          previousLine = rect.lineIndex
          previousRight = rect.right
        }
      }
    }
  })
})

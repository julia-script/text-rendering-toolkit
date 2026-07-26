import { readFile } from 'node:fs/promises'
import {
  type DecorationSegment,
  type DecorationSpan,
  deriveTextDecorations,
  type LayoutFixtureDocument,
  type LayoutResult,
  layoutResolvedText,
  validateLayoutFixtureDocument,
} from '@text-rendering-toolkit/layout'
import { describe, expect, test } from 'vitest'

const fixtureUrl = new URL('../../../test-fixtures/layout/policy-fixtures.json', import.meta.url)
const red = { red: 220, green: 50, blue: 70, alpha: 255 } as const

async function fixture(id: string): Promise<LayoutResult> {
  const document: unknown = JSON.parse(await readFile(fixtureUrl, 'utf8'))
  validateLayoutFixtureDocument(document)
  const item = (document as LayoutFixtureDocument).fixtures.find((value) => value.id === id)
  if (!item) throw new Error(`Missing fixture ${id}`)
  return layoutResolvedText(structuredClone(item.input))
}

function span(overrides: Partial<DecorationSpan> = {}): DecorationSpan {
  return {
    start: 0,
    end: 1,
    kind: 'underline',
    style: 'solid',
    color: 'foreground',
    ...overrides,
  }
}

function typedArrayConsumer(segments: readonly DecorationSegment[]): Float32Array {
  return Float32Array.from(
    segments.flatMap(({ xStart, xEnd, y, thickness, amplitude, wavelength, phase }) => [
      xStart,
      xEnd,
      y,
      thickness,
      amplitude,
      wavelength,
      phase,
    ]),
  )
}

describe('renderer-neutral text decoration derivation', () => {
  test('fragments wrapping, hard breaks, trailing spaces, partial ranges, and empty lines', async () => {
    const wrapped = await fixture('wrap-normal-soft')
    const wrappedResult = deriveTextDecorations(wrapped, [span({ start: 0, end: 3 })])
    expect(wrappedResult.segments.map(({ lineIndex }) => lineIndex)).toEqual([0, 1])

    const hard = await fixture('line-empty-and-breaks')
    expect(
      deriveTextDecorations(hard, [span({ start: 0, end: 6 })]).segments.map(
        ({ lineIndex, sourceStart, sourceEnd }) => [lineIndex, sourceStart, sourceEnd],
      ),
    ).toEqual([
      [0, 0, 3],
      [2, 4, 6],
    ])

    const trailing = await fixture('line-trailing-whitespace')
    expect(deriveTextDecorations(trailing, [span({ start: 1, end: 3 })]).segments[0]).toMatchObject(
      {
        xStart: 10,
        xEnd: 20,
      },
    )
    expect(deriveTextDecorations(trailing, []).segments).toEqual([])
  })

  test('keeps adjacent styles, colors, and visual bidi fragments independent', async () => {
    const bidi = await fixture('bidi-ltr-rtl-multiline')
    const before = structuredClone(bidi)
    const result = deriveTextDecorations(bidi, [
      span({ start: 0, end: 1, style: 'dotted', color: red }),
      span({ start: 1, end: 3, style: 'wavy', color: 'foreground' }),
      span({ start: 4, end: 5, kind: 'strikethrough', color: red }),
    ])
    expect(result.segments.map(({ lineIndex, style }) => `${lineIndex}:${style}`)).toEqual([
      '0:dotted',
      '0:wavy',
      '1:solid',
    ])
    expect(result.segments[0]?.color).toEqual(red)
    expect(result.segments[1]?.color).toBe('foreground')
    expect(bidi).toEqual(before)
  })

  test('keeps automatic metrics stable across fallback ranges and resolves adjacent spans independently', async () => {
    const layout = await fixture('runs-style-size-language')
    const automatic = deriveTextDecorations(layout, [span({ start: 0, end: 2, style: 'wavy' })])
    expect(automatic.segments).toHaveLength(1)
    expect(automatic.segments.map(({ y, thickness }) => [y, thickness])).toEqual([[-1, 0.5]])
    expect(automatic.segments).toEqual(
      expect.arrayContaining([expect.objectContaining({ amplitude: 0.5, wavelength: 2.5 })]),
    )

    const adjacent = deriveTextDecorations(layout, [
      span({ start: 0, end: 1 }),
      span({ start: 1, end: 2 }),
    ])
    expect(adjacent.segments.map(({ y, thickness }) => [y, thickness])).toEqual([
      [-1, 0.5],
      [-1.4, 0.7],
    ])

    const explicit = deriveTextDecorations(layout, [
      span({ start: 0, end: 2, thickness: 0.25, offset: -2 }),
    ])
    expect(explicit.segments).toHaveLength(1)
    expect(explicit.segments[0]).toMatchObject({ y: -2, thickness: 0.25 })
  })

  test('resolves solid, dotted, wavy, and strikethrough analytic dimensions', async () => {
    const layout = await fixture('selection-forward-reversed-empty')
    const result = deriveTextDecorations(layout, [
      span({ start: 0, end: 1 }),
      span({ start: 0, end: 1, style: 'dotted' }),
      span({ start: 0, end: 1, style: 'wavy' }),
      span({ start: 1, end: 2, kind: 'strikethrough', color: red }),
    ])
    expect(result.segments.map(({ amplitude, wavelength }) => [amplitude, wavelength])).toEqual([
      [0, 0],
      [0, 1.25],
      [0.5, 2.5],
      [0, 0],
    ])
    expect(result.segments[3]?.y).toBe(3)
    expect(typedArrayConsumer(result.segments)).toHaveLength(28)
    expect(result.bounds).toMatchObject({ left: 0, right: 20 })
  })

  test('clips and skips positioned bounds while preserving pattern phase', async () => {
    const layout = await fixture('carets-complex-clusters')
    const clipped = deriveTextDecorations(
      layout,
      [span({ start: 0, end: 9, style: 'wavy', skipInk: 'none' })],
      { clip: { left: 4, right: 46 } },
    )
    expect(clipped.segments[0]).toMatchObject({ xStart: 4, xEnd: 46, phase: 4 })

    const skipped = deriveTextDecorations(layout, [
      span({ start: 0, end: 9, style: 'wavy', skipInk: 'auto' }),
    ])
    expect(skipped.segments.length).toBeGreaterThan(1)
    expect(skipped.segments.at(-1)?.phase).toBeGreaterThan(0)

    const noBounds = await fixture('runs-fallback-grapheme')
    const continuous = deriveTextDecorations(noBounds, [
      span({ start: 0, end: 3, skipInk: 'auto', offset: -20 }),
    ])
    expect(continuous.segments).toHaveLength(1)
  })

  test('returns deeply stable values and repeatable output', async () => {
    const layout = await fixture('selection-forward-reversed-empty')
    const spans = [span({ start: 0, end: 2, color: red })]
    const first = deriveTextDecorations(layout, spans)
    expect(first).toEqual(deriveTextDecorations(layout, spans))
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.segments)).toBe(true)
    expect(first.segments.every(Object.isFrozen)).toBe(true)
    expect(Object.isFrozen(first.segments[0]?.color)).toBe(true)
    expect(Object.isFrozen(first.bounds)).toBe(true)
  })

  test('validates every span and option before derivation', async () => {
    const layout = await fixture('carets-complex-clusters')
    const invalid = [
      span({ start: 4, end: 5 }),
      span({ start: 0, end: 9, kind: 'strikethrough', style: 'wavy' }),
      span({ start: 0, end: 9, thickness: 0 }),
      span({ start: 0, end: 9, offset: Number.NaN }),
      span({ start: 0, end: 9, color: { ...red, alpha: 256 } }),
      span({ start: 0, end: 9, skipInk: 'invalid' as 'none' }),
    ]
    for (const value of invalid) expect(() => deriveTextDecorations(layout, [value])).toThrow()
    expect(() =>
      deriveTextDecorations(layout, [span({ start: 0, end: 9 })], {
        clip: { left: 10, right: 2 },
      }),
    ).toThrow('inverted')
    expect(() =>
      deriveTextDecorations(layout, [
        span({ start: 0, end: 9 }),
        span({ start: 0, end: 9, color: { ...red, red: -1 } }),
      ]),
    ).toThrow('byte')
  })
})

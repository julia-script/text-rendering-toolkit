import type { LayoutResult } from '@text-rendering-toolkit/layout'
import { describe, expect, test } from 'vitest'

import {
  cutDecorationInk,
  type DecorationSpan,
  decodeSignedDistance,
  decorationBounds,
  deriveDecorationSegments,
  expandPaintBounds,
  type PaintRequest,
  planSdfPaint,
  resolveDecorationColor,
  tessellateDecoration,
} from '../src/index.js'

const result: LayoutResult = {
  sourceLengthUtf16: 12,
  fontKeys: ['latin', 'arabic', 'emoji'],
  glyphs: [],
  lines: [
    {
      start: 0,
      end: 6,
      glyphStart: 0,
      glyphEnd: 0,
      baseline: 0,
      left: 0,
      right: 6,
      bottom: -2,
      top: 8,
      breakAfter: 'soft',
    },
    {
      start: 6,
      end: 12,
      glyphStart: 0,
      glyphEnd: 0,
      baseline: -12,
      left: 0,
      right: 6,
      bottom: -14,
      top: -4,
      breakAfter: 'none',
    },
  ],
  carets: [
    { offset: 0, lineIndex: 0, x: 0, bottom: -2, top: 8 },
    { offset: 1, lineIndex: 0, x: 1, bottom: -2, top: 8 },
    { offset: 2, lineIndex: 0, x: 2, bottom: -2, top: 8 },
    { offset: 3, lineIndex: 0, x: 3, bottom: -2, top: 8 },
    { offset: 4, lineIndex: 0, x: 4, bottom: -2, top: 8 },
    { offset: 5, lineIndex: 0, x: 5, bottom: -2, top: 8 },
    { offset: 6, lineIndex: 0, x: 6, bottom: -2, top: 8 },
    { offset: 6, lineIndex: 1, x: 0, bottom: -14, top: -4 },
    { offset: 7, lineIndex: 1, x: 1, bottom: -14, top: -4 },
    { offset: 8, lineIndex: 1, x: 4, bottom: -14, top: -4 },
    { offset: 9, lineIndex: 1, x: 3, bottom: -14, top: -4 },
    { offset: 10, lineIndex: 1, x: 2, bottom: -14, top: -4 },
    { offset: 11, lineIndex: 1, x: 5, bottom: -14, top: -4 },
    { offset: 12, lineIndex: 1, x: 6, bottom: -14, top: -4 },
  ],
  defaultDecorationMetrics: {
    underlinePosition: -1.2,
    underlineThickness: 0.625,
    strikethroughPosition: 3,
    strikethroughThickness: 0.625,
  },
  decorationMetrics: [],
  blockBounds: { left: 0, bottom: -14, right: 6, top: 8 },
  visibleBounds: null,
}

const explicit = { red: 238, green: 68, blue: 102, alpha: 255 } as const
const foreground = { red: 40, green: 80, blue: 180, alpha: 255 } as const

const spans: readonly DecorationSpan[] = [
  {
    start: 1,
    end: 11,
    kind: 'underline',
    style: 'wavy',
    color: explicit,
    skipInk: 'auto',
  },
  {
    start: 0,
    end: 3,
    kind: 'underline',
    style: 'dotted',
    color: 'foreground',
  },
  {
    start: 8,
    end: 12,
    kind: 'strikethrough',
    style: 'solid',
    color: explicit,
    thickness: 0.5,
    offset: 2,
  },
]

const paint: PaintRequest = {
  outlineWidthPixels: 4,
  shadowOffsetXPixels: 2,
  shadowOffsetYPixels: -2,
  shadowSoftnessPixels: 3,
  fillColor: foreground,
  outlineColor: explicit,
  shadowColor: { red: 0, green: 0, blue: 0, alpha: 160 },
}

describe('renderer-neutral decoration candidate', () => {
  test('fragments logical ranges through existing line and caret output', () => {
    const before = JSON.stringify(result)
    const segments = deriveDecorationSegments(result, spans)
    expect(segments.map(({ lineIndex, style }) => `${lineIndex}:${style}`)).toEqual([
      '0:wavy',
      '1:wavy',
      '0:dotted',
      '1:solid',
    ])
    expect(segments.every(Object.isFrozen)).toBe(true)
    expect(JSON.stringify(result)).toBe(before)
    expect(resolveDecorationColor(segments[2]?.color ?? explicit, foreground)).toEqual(foreground)
    expect(segments[0]?.color).toEqual(explicit)
  })

  test('uses explicit metrics without changing shaping or layout identity', () => {
    const [segment] = deriveDecorationSegments(result, [spans[0] as DecorationSpan], {
      0: {
        underlinePosition: -1.5,
        underlineThickness: 0.75,
        strikethroughPosition: 3,
        strikethroughThickness: 0.5,
      },
    })
    expect(segment).toMatchObject({ y: -1.5, thickness: 0.75 })
    expect(result.glyphs).toHaveLength(0)
  })

  test('cuts bounds-only ink while retaining logical pattern phase', () => {
    const [segment] = deriveDecorationSegments(result, [spans[0] as DecorationSpan])
    const pieces = cutDecorationInk(segment as NonNullable<typeof segment>, [
      { lineIndex: 0, left: 2.5, right: 3.5, bottom: -2, top: 1 },
    ])
    expect(pieces).toHaveLength(2)
    expect(pieces[0]?.xEnd).toBeLessThan(2.5)
    expect(pieces[1]?.xStart).toBeGreaterThan(3.5)
    expect(pieces[1]?.phase).toBeGreaterThan(0)
  })

  test('tessellates each analytic style without renderer dependencies', () => {
    const segments = deriveDecorationSegments(result, spans)
    const byStyle = new Map(
      segments.map((segment) => [segment.style, tessellateDecoration(segment)]),
    )
    expect(byStyle.get('solid')?.length).toBe(18)
    expect(byStyle.get('dotted')?.length).toBeGreaterThan(18)
    expect(byStyle.get('wavy')?.length).toBeGreaterThan(36)
    expect(decorationBounds(segments)).toMatchObject({ left: 0, right: 6 })
  })
})

describe('shared-SDF paint candidate', () => {
  test('keeps supported appearance outside resource identity', () => {
    const plan = planSdfPaint(paint, 64)
    const recolored = planSdfPaint(
      {
        ...paint,
        fillColor: explicit,
        outlineColor: foreground,
      },
      64,
    )
    expect(plan.accepted).toBe(true)
    expect(plan.paddingPixels).toBe(8)
    expect(recolored.resourceIdentity).toEqual(plan.resourceIdentity)
    expect(recolored.requiredPaddingPixels).toBe(plan.requiredPaddingPixels)
  })

  test('rejects paint whose visible extent exceeds encoded padding', () => {
    const plan = planSdfPaint({ ...paint, outlineWidthPixels: 8 }, 64)
    expect(plan.accepted).toBe(false)
    expect(plan.reason).toContain('requires 9px padding')
  })

  test('decodes signed distance and expands render bounds', () => {
    expect(Math.abs(decodeSignedDistance(128, 8, 9))).toBeLessThan(0.02)
    expect(decodeSignedDistance(0, 8, 9)).toBeCloseTo(8)
    expect(decodeSignedDistance(255, 8, 9)).toBeCloseTo(-8)
    expect(expandPaintBounds({ left: 0, bottom: 0, right: 10, top: 10 }, 0.25, paint)).toEqual({
      left: -1,
      right: 11.25,
      bottom: -1.25,
      top: 11,
    })
  })
})

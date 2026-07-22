import { getSelectionRects, type LayoutBounds, type LayoutResult } from '@webgpu-text/layout'

export interface Rgba {
  readonly red: number
  readonly green: number
  readonly blue: number
  readonly alpha: number
}

export type DecorationColor = Rgba | 'foreground'
export type DecorationKind = 'underline' | 'strikethrough'
export type DecorationStyle = 'solid' | 'dotted' | 'wavy'
export type SkipInk = 'none' | 'auto'

export interface DecorationSpan {
  readonly start: number
  readonly end: number
  readonly kind: DecorationKind
  readonly style: DecorationStyle
  readonly color: DecorationColor
  readonly thickness?: number | 'auto'
  readonly offset?: number | 'auto'
  readonly skipInk?: SkipInk
}

export interface DecorationMetrics {
  readonly underlinePosition: number
  readonly underlineThickness: number
  readonly strikethroughPosition: number
  readonly strikethroughThickness: number
}

export interface DecorationSegment {
  readonly sourceStart: number
  readonly sourceEnd: number
  readonly lineIndex: number
  readonly kind: DecorationKind
  readonly style: DecorationStyle
  readonly color: DecorationColor
  readonly xStart: number
  readonly xEnd: number
  readonly y: number
  readonly thickness: number
  readonly amplitude: number
  readonly wavelength: number
  readonly phase: number
  readonly skipInk: SkipInk
}

export interface InkBounds extends LayoutBounds {
  readonly lineIndex: number
}

export interface PaintRequest {
  readonly outlineWidthPixels: number
  readonly shadowOffsetXPixels: number
  readonly shadowOffsetYPixels: number
  readonly shadowSoftnessPixels: number
  readonly fillColor: Rgba
  readonly outlineColor: Rgba
  readonly shadowColor: Rgba
}

export interface PaintPlan {
  readonly accepted: boolean
  readonly reason: string | null
  readonly sdfSize: number
  readonly paddingPixels: number
  readonly requiredPaddingPixels: number
  readonly maximumOutlineWidthPixels: number
  readonly maximumShadowExtentPixels: number
  readonly resourceIdentity: readonly ['font', 'glyph', 'variations', 'sdfSize']
  readonly appearanceOnly: readonly [
    'fillColor',
    'outlineColor',
    'outlineWidth',
    'shadowColor',
    'shadowOffset',
    'shadowSoftness',
  ]
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`)
  return value
}

function positive(value: number, label: string): number {
  if (!(finite(value, label) > 0)) throw new RangeError(`${label} must be positive`)
  return value
}

function color(value: Rgba): Readonly<Rgba> {
  for (const [key, component] of Object.entries(value)) {
    if (!Number.isInteger(component) || component < 0 || component > 255) {
      throw new RangeError(`${key} must be a byte`)
    }
  }
  return Object.freeze({ ...value })
}

function segmentColor(value: DecorationColor): DecorationColor {
  return value === 'foreground' ? value : color(value)
}

function defaultMetrics(height: number): DecorationMetrics {
  const thickness = positive(height / 16, 'automatic decoration thickness')
  return {
    underlinePosition: -height * 0.12,
    underlineThickness: thickness,
    strikethroughPosition: height * 0.3,
    strikethroughThickness: thickness,
  }
}

function metricsFor(
  span: DecorationSpan,
  lineHeight: number,
  supplied: DecorationMetrics | undefined,
): { readonly offset: number; readonly thickness: number } {
  const metrics = supplied ?? defaultMetrics(lineHeight)
  const automaticThickness =
    span.kind === 'underline' ? metrics.underlineThickness : metrics.strikethroughThickness
  const automaticOffset =
    span.kind === 'underline' ? metrics.underlinePosition : metrics.strikethroughPosition
  return {
    thickness:
      span.thickness === undefined || span.thickness === 'auto'
        ? positive(automaticThickness, 'automatic decoration thickness')
        : positive(span.thickness, 'decoration thickness'),
    offset:
      span.offset === undefined || span.offset === 'auto'
        ? finite(automaticOffset, 'automatic decoration offset')
        : finite(span.offset, 'decoration offset'),
  }
}

function validateSpan(span: DecorationSpan, sourceLength: number): void {
  if (
    !Number.isSafeInteger(span.start) ||
    !Number.isSafeInteger(span.end) ||
    span.start < 0 ||
    span.end <= span.start ||
    span.end > sourceLength
  ) {
    throw new RangeError('decoration span must be a non-empty in-bounds UTF-16 range')
  }
  segmentColor(span.color)
}

export function deriveDecorationSegments(
  result: LayoutResult,
  spans: readonly DecorationSpan[],
  metricsByLine: Readonly<Record<number, DecorationMetrics>> = {},
): readonly DecorationSegment[] {
  const segments: DecorationSegment[] = []
  for (const span of spans) {
    validateSpan(span, result.sourceLengthUtf16)
    const rects = getSelectionRects(result, span)
    for (const rect of rects) {
      const line = result.lines[rect.lineIndex]
      if (!line || rect.right <= rect.left) continue
      const resolved = metricsFor(span, rect.top - rect.bottom, metricsByLine[rect.lineIndex])
      const thickness = resolved.thickness
      const wavelength =
        span.style === 'dotted' ? thickness * 2.5 : span.style === 'wavy' ? thickness * 5 : 0
      segments.push(
        Object.freeze({
          sourceStart: Math.max(span.start, line.start),
          sourceEnd: Math.min(span.end, line.end),
          lineIndex: rect.lineIndex,
          kind: span.kind,
          style: span.style,
          color: segmentColor(span.color),
          xStart: rect.left,
          xEnd: rect.right,
          y: line.baseline + resolved.offset,
          thickness,
          amplitude: span.style === 'wavy' ? thickness : 0,
          wavelength,
          phase: 0,
          skipInk: span.skipInk ?? 'none',
        }),
      )
    }
  }
  return Object.freeze(segments)
}

function subtractInterval(
  intervals: readonly (readonly [number, number])[],
  cutStart: number,
  cutEnd: number,
): Array<readonly [number, number]> {
  const next: Array<readonly [number, number]> = []
  for (const [start, end] of intervals) {
    if (cutEnd <= start || cutStart >= end) next.push([start, end])
    else {
      if (cutStart > start) next.push([start, Math.min(cutStart, end)])
      if (cutEnd < end) next.push([Math.max(cutEnd, start), end])
    }
  }
  return next
}

export function cutDecorationInk(
  segment: DecorationSegment,
  inkBounds: readonly InkBounds[],
): readonly DecorationSegment[] {
  if (segment.skipInk === 'none') return Object.freeze([segment])
  let intervals: Array<readonly [number, number]> = [[segment.xStart, segment.xEnd]]
  const halfBand =
    segment.style === 'wavy' ? segment.amplitude + segment.thickness / 2 : segment.thickness / 2
  for (const ink of inkBounds) {
    if (
      ink.lineIndex !== segment.lineIndex ||
      ink.top < segment.y - halfBand ||
      ink.bottom > segment.y + halfBand
    ) {
      continue
    }
    intervals = subtractInterval(
      intervals,
      ink.left - segment.thickness / 2,
      ink.right + segment.thickness / 2,
    )
  }
  return Object.freeze(
    intervals
      .filter(([start, end]) => end > start)
      .map(([start, end]) =>
        Object.freeze({
          ...segment,
          xStart: start,
          xEnd: end,
          phase: segment.phase + (start - segment.xStart),
        }),
      ),
  )
}

function vertex(target: number[], x: number, y: number): void {
  target.push(x, y, 0)
}

function quad(
  target: number[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): void {
  vertex(target, ax, ay)
  vertex(target, bx, by)
  vertex(target, cx, cy)
  vertex(target, ax, ay)
  vertex(target, cx, cy)
  vertex(target, dx, dy)
}

export function tessellateDecoration(segment: DecorationSegment): Float32Array {
  const positions: number[] = []
  const half = segment.thickness / 2
  if (segment.style === 'solid') {
    quad(
      positions,
      segment.xStart,
      segment.y - half,
      segment.xEnd,
      segment.y - half,
      segment.xEnd,
      segment.y + half,
      segment.xStart,
      segment.y + half,
    )
  } else if (segment.style === 'dotted') {
    const radius = half
    const spacing = segment.wavelength
    for (let center = segment.xStart + radius; center <= segment.xEnd - radius; center += spacing) {
      for (let side = 0; side < 12; side++) {
        const first = (side / 12) * Math.PI * 2
        const second = ((side + 1) / 12) * Math.PI * 2
        vertex(positions, center, segment.y)
        vertex(positions, center + Math.cos(first) * radius, segment.y + Math.sin(first) * radius)
        vertex(positions, center + Math.cos(second) * radius, segment.y + Math.sin(second) * radius)
      }
    }
  } else {
    const step = segment.wavelength / 8
    for (let start = segment.xStart; start < segment.xEnd; start += step) {
      const end = Math.min(start + step, segment.xEnd)
      const startY =
        segment.y +
        Math.sin(((start - segment.xStart + segment.phase) / segment.wavelength) * Math.PI * 2) *
          segment.amplitude
      const endY =
        segment.y +
        Math.sin(((end - segment.xStart + segment.phase) / segment.wavelength) * Math.PI * 2) *
          segment.amplitude
      const length = Math.hypot(end - start, endY - startY)
      const nx = (-(endY - startY) / length) * half
      const ny = ((end - start) / length) * half
      quad(
        positions,
        start + nx,
        startY + ny,
        end + nx,
        endY + ny,
        end - nx,
        endY - ny,
        start - nx,
        startY - ny,
      )
    }
  }
  return new Float32Array(positions)
}

export function resolveDecorationColor(value: DecorationColor, foreground: Rgba): Readonly<Rgba> {
  return value === 'foreground' ? color(foreground) : color(value)
}

export function decorationBounds(segments: readonly DecorationSegment[]): LayoutBounds | null {
  let result: LayoutBounds | null = null
  for (const segment of segments) {
    const halfHeight =
      segment.style === 'wavy' ? segment.amplitude + segment.thickness / 2 : segment.thickness / 2
    const bounds = {
      left: segment.xStart,
      right: segment.xEnd,
      bottom: segment.y - halfHeight,
      top: segment.y + halfHeight,
    }
    result = result
      ? {
          left: Math.min(result.left, bounds.left),
          right: Math.max(result.right, bounds.right),
          bottom: Math.min(result.bottom, bounds.bottom),
          top: Math.max(result.top, bounds.top),
        }
      : bounds
  }
  return result
}

export function planSdfPaint(request: PaintRequest, sdfSize: number): PaintPlan {
  if (!Number.isSafeInteger(sdfSize) || sdfSize < 16 || sdfSize > 512) {
    throw new RangeError('sdfSize must be an integer from 16 through 512')
  }
  const outline = Math.max(0, finite(request.outlineWidthPixels, 'outline width'))
  const softness = Math.max(0, finite(request.shadowSoftnessPixels, 'shadow softness'))
  const offsetX = Math.abs(finite(request.shadowOffsetXPixels, 'shadow x offset'))
  const offsetY = Math.abs(finite(request.shadowOffsetYPixels, 'shadow y offset'))
  color(request.fillColor)
  color(request.outlineColor)
  color(request.shadowColor)
  const paddingPixels = Math.max(2, Math.floor(sdfSize / 8))
  const shadowExtent = Math.max(offsetX, offsetY) + softness
  const requiredPaddingPixels = Math.ceil(Math.max(outline, shadowExtent)) + 1
  const accepted = requiredPaddingPixels <= paddingPixels
  return Object.freeze({
    accepted,
    reason: accepted
      ? null
      : `paint requires ${requiredPaddingPixels}px padding but sdfSize ${sdfSize} provides ${paddingPixels}px`,
    sdfSize,
    paddingPixels,
    requiredPaddingPixels,
    maximumOutlineWidthPixels: paddingPixels - 1,
    maximumShadowExtentPixels: paddingPixels - 1,
    resourceIdentity: ['font', 'glyph', 'variations', 'sdfSize'] as const,
    appearanceOnly: [
      'fillColor',
      'outlineColor',
      'outlineWidth',
      'shadowColor',
      'shadowOffset',
      'shadowSoftness',
    ] as const,
  })
}

export function decodeSignedDistance(
  encodedByte: number,
  maximumDistance: number,
  exponent: number,
): number {
  if (!Number.isInteger(encodedByte) || encodedByte < 0 || encodedByte > 255) {
    throw new RangeError('encoded distance must be a byte')
  }
  positive(maximumDistance, 'maximum distance')
  positive(exponent, 'distance exponent')
  if (encodedByte === 127 || encodedByte === 128) return 0
  const alpha = encodedByte / 255
  const edgeMagnitude = alpha < 0.5 ? alpha * 2 : (1 - alpha) * 2
  const distance = maximumDistance * (1 - edgeMagnitude ** (1 / exponent))
  return alpha >= 0.5 ? -distance : distance
}

export function expandPaintBounds(
  bounds: LayoutBounds,
  unitsPerPixel: number,
  request: PaintRequest,
): LayoutBounds {
  positive(unitsPerPixel, 'units per pixel')
  const left =
    Math.max(
      request.outlineWidthPixels,
      request.shadowSoftnessPixels - request.shadowOffsetXPixels,
    ) * unitsPerPixel
  const right =
    Math.max(
      request.outlineWidthPixels,
      request.shadowSoftnessPixels + request.shadowOffsetXPixels,
    ) * unitsPerPixel
  const bottom =
    Math.max(
      request.outlineWidthPixels,
      request.shadowSoftnessPixels - request.shadowOffsetYPixels,
    ) * unitsPerPixel
  const top =
    Math.max(
      request.outlineWidthPixels,
      request.shadowSoftnessPixels + request.shadowOffsetYPixels,
    ) * unitsPerPixel
  return {
    left: bounds.left - left,
    right: bounds.right + right,
    bottom: bounds.bottom - bottom,
    top: bounds.top + top,
  }
}

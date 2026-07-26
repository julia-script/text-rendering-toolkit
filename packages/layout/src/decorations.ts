import type { RgbaColor } from '@text-rendering-toolkit/font'
import { getSelectionRects } from './selection.js'
import type {
  DecorationBounds,
  DecorationColor,
  DecorationDerivationOptions,
  DecorationSegment,
  DecorationSpan,
  LayoutDecorationMetricRange,
  LayoutResult,
  PositionedGlyph,
  TextDecorationResult,
} from './types.js'

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`)
  return value
}

function positive(value: number, label: string): number {
  if (finite(value, label) <= 0) throw new RangeError(`${label} must be positive`)
  return value
}

function paint(value: DecorationColor, label: string): DecorationColor {
  if (value === 'foreground') return value
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an RGBA byte color or "foreground"`)
  }
  const source = value as RgbaColor
  for (const key of ['red', 'green', 'blue', 'alpha'] as const) {
    const component = source[key]
    if (!Number.isInteger(component) || component < 0 || component > 255) {
      throw new RangeError(`${label}.${key} must be a byte`)
    }
  }
  return Object.freeze({
    red: source.red,
    green: source.green,
    blue: source.blue,
    alpha: source.alpha,
  })
}

function validateInputs(
  layout: LayoutResult,
  spans: readonly DecorationSpan[],
  options: DecorationDerivationOptions,
): readonly DecorationColor[] {
  if (!Array.isArray(spans)) throw new TypeError('decoration spans must be an array')
  const boundaries = new Set(layout.carets.map(({ offset }) => offset))
  boundaries.add(0)
  boundaries.add(layout.sourceLengthUtf16)
  const colors: DecorationColor[] = []
  for (const [index, span] of spans.entries()) {
    const label = `spans[${index}]`
    if (typeof span !== 'object' || span === null || Array.isArray(span)) {
      throw new TypeError(`${label} must be an object`)
    }
    if (
      !Number.isSafeInteger(span.start) ||
      !Number.isSafeInteger(span.end) ||
      span.start < 0 ||
      span.end <= span.start ||
      span.end > layout.sourceLengthUtf16
    ) {
      throw new RangeError(`${label} must be a non-empty in-bounds UTF-16 range`)
    }
    if (!boundaries.has(span.start) || !boundaries.has(span.end)) {
      throw new RangeError(`${label} boundaries must be editable grapheme boundaries`)
    }
    if (span.kind !== 'underline' && span.kind !== 'strikethrough') {
      throw new TypeError(`${label}.kind is unsupported`)
    }
    if (!['solid', 'dotted', 'wavy'].includes(span.style)) {
      throw new TypeError(`${label}.style is unsupported`)
    }
    if (span.kind === 'strikethrough' && span.style !== 'solid') {
      throw new TypeError(`${label} uses an unsupported kind/style combination`)
    }
    if (span.skipInk !== undefined && span.skipInk !== 'none' && span.skipInk !== 'auto') {
      throw new TypeError(`${label}.skipInk is unsupported`)
    }
    if (span.thickness !== undefined && span.thickness !== 'auto') {
      positive(span.thickness, `${label}.thickness`)
    }
    if (span.offset !== undefined && span.offset !== 'auto') {
      finite(span.offset, `${label}.offset`)
    }
    colors.push(paint(span.color, `${label}.color`))
  }
  if (options.clip) {
    finite(options.clip.left, 'options.clip.left')
    finite(options.clip.right, 'options.clip.right')
    if (options.clip.left > options.clip.right) throw new RangeError('options.clip is inverted')
  }
  return colors
}

function automatic(value: number | 'auto' | undefined): boolean {
  return value === undefined || value === 'auto'
}

function metricsAt(
  layout: LayoutResult,
  start: number,
  end: number,
): LayoutDecorationMetricRange | LayoutResult['defaultDecorationMetrics'] {
  return (
    layout.decorationMetrics.find((range) => range.start < end && range.end > start) ??
    layout.defaultDecorationMetrics
  )
}

function resolvedMetrics(
  layout: LayoutResult,
  span: DecorationSpan,
  start: number,
  end: number,
): { readonly offset: number; readonly thickness: number } {
  const metrics = metricsAt(layout, start, end)
  const automaticOffset =
    span.kind === 'underline' ? metrics.underlinePosition : metrics.strikethroughPosition
  const automaticThickness =
    span.kind === 'underline' ? metrics.underlineThickness : metrics.strikethroughThickness
  return {
    offset: automatic(span.offset) ? automaticOffset : (span.offset as number),
    thickness: automatic(span.thickness) ? automaticThickness : (span.thickness as number),
  }
}

function clipSegment(
  segment: DecorationSegment,
  options: DecorationDerivationOptions,
): DecorationSegment | null {
  if (!options.clip) return segment
  const xStart = Math.max(segment.xStart, options.clip.left)
  const xEnd = Math.min(segment.xEnd, options.clip.right)
  if (xEnd <= xStart) return null
  return Object.freeze({
    ...segment,
    xStart,
    xEnd,
    phase: segment.phase + (xStart - segment.xStart),
  })
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

function positionedBounds(glyph: PositionedGlyph): DecorationBounds | null {
  if (!glyph.bounds) return null
  return {
    left: glyph.x + glyph.xOffset + glyph.bounds.left,
    bottom: glyph.y + glyph.yOffset + glyph.bounds.bottom,
    right: glyph.x + glyph.xOffset + glyph.bounds.right,
    top: glyph.y + glyph.yOffset + glyph.bounds.top,
  }
}

function skipInk(layout: LayoutResult, segment: DecorationSegment): readonly DecorationSegment[] {
  if (segment.skipInk === 'none') return [segment]
  let intervals: Array<readonly [number, number]> = [[segment.xStart, segment.xEnd]]
  const halfBand =
    segment.style === 'wavy' ? segment.amplitude + segment.thickness / 2 : segment.thickness / 2
  for (const glyph of layout.glyphs) {
    if (glyph.lineIndex !== segment.lineIndex) continue
    const ink = positionedBounds(glyph)
    if (!ink || ink.top < segment.y - halfBand || ink.bottom > segment.y + halfBand) continue
    intervals = subtractInterval(
      intervals,
      ink.left - segment.thickness / 2,
      ink.right + segment.thickness / 2,
    )
  }
  return intervals
    .filter(([start, end]) => end > start)
    .map(([start, end]) =>
      Object.freeze({
        ...segment,
        xStart: start,
        xEnd: end,
        phase: segment.phase + (start - segment.xStart),
      }),
    )
}

function boundsFor(segments: readonly DecorationSegment[]): DecorationBounds | null {
  let bounds: DecorationBounds | null = null
  for (const segment of segments) {
    const halfHeight =
      segment.style === 'wavy' ? segment.amplitude + segment.thickness / 2 : segment.thickness / 2
    const current = {
      left: segment.xStart,
      bottom: segment.y - halfHeight,
      right: segment.xEnd,
      top: segment.y + halfHeight,
    }
    bounds = bounds
      ? {
          left: Math.min(bounds.left, current.left),
          bottom: Math.min(bounds.bottom, current.bottom),
          right: Math.max(bounds.right, current.right),
          top: Math.max(bounds.top, current.top),
        }
      : current
  }
  return bounds ? Object.freeze(bounds) : null
}

/**
 * Derives appearance-only analytic text decorations from an existing layout.
 *
 * @remarks
 * A synchronous, pure post-layout step. It does not prepare, shape, reshape,
 * fetch fonts, request outlines, tessellate paths, or import a renderer — which
 * is what makes restyling cheap: changing color, style, skip-ink, or numeric
 * metrics reuses the same {@link PreparedText} and {@link LayoutResult}.
 *
 * Output is analytic rather than tessellated. Each {@link DecorationSegment}
 * describes a line fragment — position, thickness, and for patterned styles the
 * amplitude, wavelength, and phase — leaving geometry generation to the
 * renderer. A single span yields several segments where it crosses lines, bidi
 * boundaries, or skip-ink gaps, with phase carried across the cuts so patterns
 * stay continuous.
 *
 * Supported combinations are solid, dotted, and wavy underline plus solid
 * strikethrough. Automatic thickness and offset use the first effective
 * retained font metrics for the whole span, so a fallback font mid-span does
 * not introduce a vertical step. These are default-instance metrics: MVAR
 * adjustments are not applied, so use numeric overrides when a specific
 * variable instance needs corrected placement.
 *
 * @param layout - The layout to decorate.
 * @param spans - Independent source ranges; they may overlap and each resolves
 *   on its own.
 * @param options - Optional horizontal clip for viewport culling.
 * @returns Frozen segments plus their aggregate bounds, or `null` bounds when
 *   nothing was produced.
 * @throws {@link InvalidLayoutInputError} for malformed spans — non-finite
 *   numeric overrides, an unsupported kind/style pairing, or an invalid color.
 *
 * @example
 * A wavy underline over the first word.
 * ```typescript
 * const decorations = deriveTextDecorations(result, [
 *   {
 *     start: 0,
 *     end: 5,
 *     kind: 'underline',
 *     style: 'wavy',
 *     color: { red: 30, green: 160, blue: 255, alpha: 255 },
 *     skipInk: 'auto',
 *   },
 * ])
 * decorations.segments[0]?.style // 'wavy'
 * decorations.segments[0]?.y // negative — below the baseline
 * decorations.segments[0]?.wavelength // thickness * 5
 * ```
 */
export function deriveTextDecorations(
  layout: LayoutResult,
  spans: readonly DecorationSpan[],
  options: DecorationDerivationOptions = {},
): TextDecorationResult {
  const colors = validateInputs(layout, spans, options)
  const segments: DecorationSegment[] = []
  for (const [spanIndex, span] of spans.entries()) {
    const metrics = resolvedMetrics(layout, span, span.start, span.end)
    for (const rect of getSelectionRects(layout, span)) {
      const line = layout.lines[rect.lineIndex]
      if (!line || rect.right <= rect.left) continue
      const wavelength =
        span.style === 'dotted'
          ? metrics.thickness * 2.5
          : span.style === 'wavy'
            ? metrics.thickness * 5
            : 0
      const segment = clipSegment(
        Object.freeze({
          sourceStart: Math.max(span.start, line.start),
          sourceEnd: Math.min(span.end, line.end),
          lineIndex: rect.lineIndex,
          kind: span.kind,
          style: span.style,
          color: colors[spanIndex] as DecorationColor,
          xStart: rect.left,
          xEnd: rect.right,
          y: line.baseline + metrics.offset,
          thickness: metrics.thickness,
          amplitude: span.style === 'wavy' ? metrics.thickness : 0,
          wavelength,
          phase: 0,
          skipInk: span.skipInk ?? 'none',
        }),
        options,
      )
      if (segment) segments.push(...skipInk(layout, segment))
    }
  }
  const frozen = Object.freeze(segments)
  return Object.freeze({ segments: frozen, bounds: boundsFor(frozen) })
}

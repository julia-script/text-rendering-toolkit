import type { FontHandle } from '@text-rendering-toolkit/font'
import { TextPreparationError } from './errors.js'
import { isMandatoryBreakControl } from './internal/break-controls.js'
import { layoutResolvedText } from './layout.js'
import { prepareText, validatePreparedText } from './preparation.js'
import type {
  FontRegistry,
  LayoutResult,
  LineBreakOpportunity,
  PreparedSegment,
  PreparedText,
  PrepareTextInput,
  ResolvedGlyph,
  ResolvedRunMetrics,
  ResolvedShapedRun,
  TextStyle,
} from './types.js'

const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' })
const COVERAGE_IGNORABLE = /\p{Default_Ignorable_Code_Point}/u

interface SelectedSegment extends PreparedSegment {
  readonly fontKey: string
  readonly font: FontHandle
}

interface ContentSegment {
  readonly start: number
  readonly contentEnd: number
  readonly end: number
  readonly hard: boolean
}

type ShapeMemo = WeakMap<SelectedSegment, Map<string, ResolvedShapedRun>>

function registry(fonts: FontRegistry): FontRegistry {
  if (!fonts || typeof fonts.get !== 'function') {
    throw new TextPreparationError('invalid-input', 'fonts must be a readonly map')
  }
  return fonts
}

function registeredFonts(
  fontKeys: readonly string[],
  fonts: FontRegistry,
  start: number,
  end: number,
): readonly { readonly fontKey: string; readonly font: FontHandle }[] {
  return fontKeys.map((fontKey) => {
    const font = fonts.get(fontKey)
    if (!font) {
      throw new TextPreparationError('missing-font', `font registry has no key ${fontKey}`, {
        start,
        end,
        attemptedFontKeys: fontKeys,
      })
    }
    return { fontKey, font }
  })
}

function selectFont(
  segment: PreparedSegment,
  text: string,
  start: number,
  end: number,
  fonts: FontRegistry,
): { readonly fontKey: string; readonly font: FontHandle } {
  const candidates = registeredFonts(segment.fontKeys, fonts, start, end)
  const cluster = text.slice(start, end)
  for (const candidate of candidates) {
    const covered = [...cluster].every(
      (character) =>
        COVERAGE_IGNORABLE.test(character) ||
        candidate.font.supports(character.codePointAt(0) ?? -1),
    )
    if (covered) return candidate
  }
  throw new TextPreparationError(
    'missing-coverage',
    `no preferred font covers ${JSON.stringify(cluster)}`,
    { start, end, attemptedFontKeys: segment.fontKeys },
  )
}

function sameShape(left: SelectedSegment, right: SelectedSegment): boolean {
  return (
    left.end === right.start &&
    left.font === right.font &&
    left.fontKey === right.fontKey &&
    left.paragraphLevel === right.paragraphLevel &&
    left.bidiLevel === right.bidiLevel &&
    left.direction === right.direction &&
    left.script === right.script &&
    left.styleKey === right.styleKey &&
    left.fontSize === right.fontSize &&
    left.language === right.language &&
    left.features.join('\0') === right.features.join('\0') &&
    JSON.stringify(left.variations) === JSON.stringify(right.variations)
  )
}

function selectedSegments(prepared: PreparedText, fonts: FontRegistry): readonly SelectedSegment[] {
  const selected: SelectedSegment[] = []
  for (const segment of prepared.segments) {
    const source = prepared.text.slice(segment.start, segment.end)
    for (const grapheme of segmenter.segment(source)) {
      const start = segment.start + grapheme.index
      const end = start + grapheme.segment.length
      const choice = selectFont(segment, prepared.text, start, end, fonts)
      const current: SelectedSegment = { ...segment, start, end, ...choice }
      const previous = selected.at(-1)
      if (previous && sameShape(previous, current)) {
        selected[selected.length - 1] = { ...previous, end }
      } else {
        selected.push(current)
      }
    }
  }
  return selected
}

function scaledMetrics(font: FontHandle, scale: number): ResolvedRunMetrics {
  const decoration = font.facts.decorationMetrics
  return {
    ascender: font.facts.ascender * scale,
    descender: font.facts.descender * scale,
    lineGap: font.facts.lineGap * scale,
    decorationMetrics: {
      underlinePosition: decoration.underlinePosition * scale,
      underlineThickness: decoration.underlineThickness * scale,
      strikethroughPosition: decoration.strikethroughPosition * scale,
      strikethroughThickness: decoration.strikethroughThickness * scale,
    },
  }
}

function shapeSegment(
  segment: SelectedSegment,
  text: string,
  start = segment.start,
  end = segment.end,
): ResolvedShapedRun {
  const scale = segment.fontSize / segment.font.facts.unitsPerEm
  const shaped = segment.font.shape({
    text: text.slice(start, end),
    direction: segment.direction,
    script: segment.script,
    language: segment.language,
    features: segment.features,
    variations: segment.variations,
  })
  const glyphs: ResolvedGlyph[] = shaped.glyphs.map((glyph) => ({
    glyphId: glyph.glyphId,
    start: start + glyph.clusterStart,
    end: start + glyph.clusterEnd,
    xAdvance: glyph.xAdvance * scale,
    yAdvance: glyph.yAdvance * scale,
    xOffset: glyph.xOffset * scale,
    yOffset: glyph.yOffset * scale,
    flags: glyph.flags,
    bounds: null,
  }))
  return {
    start,
    end,
    direction: segment.direction,
    bidiLevel: segment.bidiLevel,
    script: segment.script,
    language: segment.language,
    styleKey: segment.styleKey,
    fontKey: segment.fontKey,
    fontSize: segment.fontSize,
    fontUnitScale: scale,
    metrics: scaledMetrics(segment.font, scale),
    variations: shaped.variations,
    glyphs,
  }
}

function memoizedShape(
  segment: SelectedSegment,
  text: string,
  start: number,
  end: number,
  memo: ShapeMemo,
): ResolvedShapedRun {
  let fragments = memo.get(segment)
  if (!fragments) {
    fragments = new Map()
    memo.set(segment, fragments)
  }
  const key = `${start}:${end}`
  let shaped = fragments.get(key)
  if (!shaped) {
    shaped = shapeSegment(segment, text, start, end)
    fragments.set(key, shaped)
  }
  return shaped
}

function shapeRange(
  selected: readonly SelectedSegment[],
  text: string,
  start: number,
  end: number,
  memo: ShapeMemo,
): readonly ResolvedShapedRun[] {
  const runs: ResolvedShapedRun[] = []
  for (const segment of selected) {
    const fragmentStart = Math.max(start, segment.start)
    const fragmentEnd = Math.min(end, segment.end)
    if (fragmentStart < fragmentEnd) {
      runs.push(memoizedShape(segment, text, fragmentStart, fragmentEnd, memo))
    }
  }
  return runs
}

function contentSegments(text: string): readonly ContentSegment[] {
  const segments: ContentSegment[] = []
  let start = 0
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (!character || !isMandatoryBreakControl(character)) continue
    const length = character === '\r' && text[index + 1] === '\n' ? 2 : 1
    segments.push({ start, contentEnd: index, end: index + length, hard: true })
    index += length - 1
    start = index + 1
  }
  segments.push({ start, contentEnd: text.length, end: text.length, hard: false })
  return segments
}

function shapedBoundaries(text: string, runs: readonly ResolvedShapedRun[]): ReadonlySet<number> {
  const boundaries = new Set<number>([0, text.length])
  for (const run of runs) {
    boundaries.add(run.start)
    boundaries.add(run.end)
    for (const glyph of run.glyphs) {
      boundaries.add(glyph.start)
      boundaries.add(glyph.end)
    }
  }
  for (const segment of contentSegments(text)) {
    boundaries.add(segment.start)
    boundaries.add(segment.contentEnd)
    boundaries.add(segment.end)
  }
  return boundaries
}

function exactContentWidth(
  text: string,
  runs: readonly ResolvedShapedRun[],
  letterSpacing: number,
): number {
  const grouped = new Map<string, { start: number; end: number; advance: number }>()
  for (const run of runs) {
    for (const glyph of run.glyphs) {
      const key = `${glyph.start}:${glyph.end}`
      const cluster = grouped.get(key) ?? { start: glyph.start, end: glyph.end, advance: 0 }
      cluster.advance += glyph.xAdvance
      grouped.set(key, cluster)
    }
  }
  const clusters = [...grouped.values()].sort(
    (left, right) => left.start - right.start || left.end - right.end,
  )
  let contentEnd = clusters.length
  while (
    contentEnd > 0 &&
    /^\s+$/u.test(text.slice(clusters[contentEnd - 1]?.start, clusters[contentEnd - 1]?.end))
  ) {
    contentEnd -= 1
  }
  return clusters
    .slice(0, contentEnd)
    .reduce(
      (width, cluster, index) =>
        width + cluster.advance + (index + 1 < contentEnd ? letterSpacing : 0),
      0,
    )
}

function finalRuns(
  selected: readonly SelectedSegment[],
  text: string,
  breaks: ReadonlySet<number>,
  memo: ShapeMemo,
): readonly ResolvedShapedRun[] {
  return selected.flatMap((segment) => {
    const cuts = [
      segment.start,
      ...[...breaks].filter((position) => segment.start < position && position < segment.end),
      segment.end,
    ].sort((left, right) => left - right)
    return cuts
      .slice(0, -1)
      .map((start, index) => memoizedShape(segment, text, start, cuts[index + 1] as number, memo))
  })
}

function selectExactBreaks(
  prepared: PreparedText,
  selected: readonly SelectedSegment[],
  provisionalRuns: readonly ResolvedShapedRun[],
  provisionalLines: LayoutResult['lines'],
  memo: ShapeMemo,
): ReadonlySet<number> {
  const selectedBreaks = new Set<number>()
  if (prepared.layout.maxWidth === null || prepared.layout.whiteSpace === 'nowrap') {
    return selectedBreaks
  }

  const fullShapeBoundaries = shapedBoundaries(prepared.text, provisionalRuns)
  const graphemes = new Set<number>([0, prepared.text.length])
  for (const grapheme of segmenter.segment(prepared.text)) {
    graphemes.add(grapheme.index)
    graphemes.add(grapheme.index + grapheme.segment.length)
  }
  const widthMemo = new Map<string, number>()
  const fits = (start: number, end: number, lineIndex: number): boolean => {
    const key = `${start}:${end}`
    let width = widthMemo.get(key)
    if (width === undefined) {
      width = exactContentWidth(
        prepared.text,
        shapeRange(selected, prepared.text, start, end, memo),
        prepared.layout.letterSpacing,
      )
      widthMemo.set(key, width)
    }
    const indent = lineIndex === 0 ? prepared.layout.textIndent : 0
    return indent + width <= (prepared.layout.maxWidth as number)
  }

  let lineIndex = 0
  for (const content of contentSegments(prepared.text)) {
    let lineStart = content.start
    while (lineStart < content.contentEnd) {
      const candidates = prepared.breakOpportunities
        .filter(
          (opportunity) =>
            !opportunity.required &&
            opportunity.position > lineStart &&
            opportunity.position <= content.contentEnd,
        )
        .map((opportunity) => opportunity.position)
      if (candidates.at(-1) !== content.contentEnd) candidates.push(content.contentEnd)

      const provisionalLine = provisionalLines.find((line) => line.start === lineStart)
      let candidateIndex = provisionalLine
        ? Math.max(
            0,
            candidates.findLastIndex((position) => position <= provisionalLine.end),
          )
        : 0
      let accepted = -1
      if (fits(lineStart, candidates[candidateIndex] as number, lineIndex)) {
        accepted = candidateIndex
        while (
          accepted + 1 < candidates.length &&
          fits(lineStart, candidates[accepted + 1] as number, lineIndex)
        ) {
          accepted += 1
        }
      } else {
        while (candidateIndex >= 0) {
          if (fits(lineStart, candidates[candidateIndex] as number, lineIndex)) {
            accepted = candidateIndex
            break
          }
          candidateIndex -= 1
        }
      }

      let breakPosition = accepted >= 0 ? (candidates[accepted] as number) : content.contentEnd
      if (accepted < 0 && prepared.layout.overflowWrap === 'break-word') {
        const emergency = [...graphemes]
          .filter(
            (position) =>
              position > lineStart &&
              position < content.contentEnd &&
              fullShapeBoundaries.has(position),
          )
          .sort((left, right) => left - right)
        let emergencyFit = -1
        for (const position of emergency) {
          if (!fits(lineStart, position, lineIndex)) break
          emergencyFit = position
        }
        breakPosition = emergencyFit >= 0 ? emergencyFit : (emergency[0] ?? content.contentEnd)
      }

      if (breakPosition >= content.contentEnd) break
      selectedBreaks.add(breakPosition)
      lineStart = breakPosition
      lineIndex += 1
    }
    if (content.hard) lineIndex += 1
  }
  return selectedBreaks
}

function defaultMetrics(
  style: TextStyle,
  fonts: FontRegistry,
  textLength: number,
): ResolvedRunMetrics {
  const first = registeredFonts(style.fontKeys, fonts, 0, textLength)[0]
  if (!first) throw new TextPreparationError('missing-font', 'default style has no font keys')
  return scaledMetrics(first.font, style.fontSize / first.font.facts.unitsPerEm)
}

/**
 * Lays out an existing {@link PreparedText} against a font registry, selecting
 * fonts, shaping, scaling, and wrapping.
 *
 * @remarks
 * This is the font-dependent half of raw-text layout. Reach for it over
 * {@link layoutText} when the same prepared text is laid out more than once —
 * after a font swap, or when the preparation was cached, persisted, or
 * transferred from a worker. Preparation is the expensive text analysis, so
 * reusing it is the main performance lever this package offers.
 *
 * Font selection runs per grapheme down {@link TextStyle.fontKeys}, taking the
 * first font that covers the whole grapheme. Lines are then measured against
 * the prepared break opportunities and the exact chosen fragments are reshaped,
 * so wrapped output reflects real shaped widths rather than a sum of unshaped
 * parts.
 *
 * The registry is only read: no font is fetched, cached, mutated, or disposed,
 * and no reference is retained after the call.
 *
 * @param prepared - Result of {@link prepareText}, or a structurally equivalent
 *   parsed value; it is re-validated, so deserialized JSON is safe to pass.
 * @param fonts - Caller-owned map from font key to loaded handle.
 * @returns The renderer-neutral layout.
 * @throws {@link TextPreparationError} with `code: 'invalid-input'` if the
 *   prepared value fails validation, `'missing-font'` if a named key is absent
 *   from the registry, or `'missing-coverage'` if no listed font covers a
 *   grapheme.
 *
 * @example
 * Prepare once, then lay out against two registries.
 * ```typescript
 * const prepared = prepareText(input)
 * const draft = layoutPreparedText(prepared, draftFonts)
 * const final = layoutPreparedText(prepared, productionFonts)
 * ```
 */
export function layoutPreparedText(prepared: PreparedText, fonts: FontRegistry): LayoutResult {
  const validated = validatePreparedText(prepared)
  const fontRegistry = registry(fonts)
  const selected = selectedSegments(validated, fontRegistry)
  const memo: ShapeMemo = new WeakMap()
  const provisionalRuns = selected.map((segment) =>
    memoizedShape(segment, validated.text, segment.start, segment.end, memo),
  )
  const metrics = defaultMetrics(validated.defaultStyle, fontRegistry, validated.text.length)
  const base = {
    text: validated.text,
    paragraphLevel:
      validated.segments[0]?.paragraphLevel ?? (validated.paragraphDirection === 'rtl' ? 1 : 0),
    defaultMetrics: metrics,
    ...validated.layout,
  }
  const provisionalBoundaries = shapedBoundaries(validated.text, provisionalRuns)
  const provisionalOpportunities = validated.breakOpportunities.filter(
    (opportunity) => opportunity.required || provisionalBoundaries.has(opportunity.position),
  )
  const provisional = layoutResolvedText({
    ...base,
    runs: provisionalRuns,
    breakOpportunities: provisionalOpportunities,
  })
  const selectedBreaks = selectExactBreaks(
    validated,
    selected,
    provisionalRuns,
    provisional.lines,
    memo,
  )
  const finalOpportunities: readonly LineBreakOpportunity[] = validated.breakOpportunities.filter(
    (opportunity) =>
      opportunity.required ||
      opportunity.position === validated.text.length ||
      selectedBreaks.has(opportunity.position),
  )
  return layoutResolvedText({
    ...base,
    runs: finalRuns(selected, validated.text, selectedBreaks, memo),
    breakOpportunities: finalOpportunities,
  })
}

/**
 * Lays out raw text in one call: prepares it, then lays out the result.
 *
 * @remarks
 * The convenience path, and the right default when preparation will not be
 * reused. It is exactly `layoutPreparedText(prepareText(input), fonts)`, so
 * split it into those two calls when you want to cache, persist, or transfer
 * the intermediate {@link PreparedText}.
 *
 * @param input - Text, style, and layout policy.
 * @param fonts - Caller-owned map from font key to loaded handle.
 * @returns The renderer-neutral layout.
 * @throws {@link TextPreparationError} for invalid input, an unregistered font
 *   key, or a grapheme no listed font covers.
 *
 * @example
 * Wrap a sentence to a fixed width.
 * ```typescript
 * const result = layoutText(
 *   {
 *     text: 'the quick brown fox jumps over the lazy dog',
 *     style: { key: 'body', fontKeys: ['latin'], fontSize: 16, language: 'en' },
 *     layout: { maxWidth: 120 },
 *   },
 *   fonts,
 * )
 * result.lines.length // 4
 * result.lines[0]?.breakAfter // 'soft'
 * ```
 */
export function layoutText(input: PrepareTextInput, fonts: FontRegistry): LayoutResult {
  return layoutPreparedText(prepareText(input), fonts)
}

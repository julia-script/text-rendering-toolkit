import bidiFactory from 'bidi-js'
import { unicodeScriptCode, unicodeScriptExtensionCodes } from 'unicode-script'
import { TextPreparationError } from './errors.js'
import { mandatoryLineBreakBoundaries } from './internal/break-controls.js'
import { lineBreakOpportunities } from './internal/line-break.js'
import type {
  LayoutPolicy,
  LineBreakOpportunity,
  ParagraphDirection,
  PreparedSegment,
  PreparedText,
  PrepareTextInput,
  TextStyle,
  TextStyleRange,
} from './types.js'

const bidi = bidiFactory()
const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' })
const HARD_BREAK = /[\n\v\f\r\u0085\u2028\u2029]/u
const STRONG_SCRIPT = /^(?!Zyyy$|Zinh$|Zzzz$)[A-Z][a-z]{3}$/
const SCRIPT = /^[A-Z][a-z]{3}$/
const LANGUAGE = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/
const AXIS = /^[\x20-\x7e]{4}$/

const DEFAULT_LAYOUT: LayoutPolicy = Object.freeze({
  maxWidth: null,
  whiteSpace: 'normal',
  overflowWrap: 'normal',
  textAlign: 'left',
  textIndent: 0,
  letterSpacing: 0,
  lineHeight: 'normal',
  anchorX: 0,
  anchorY: 0,
})

interface Cluster {
  readonly start: number
  readonly end: number
  readonly text: string
  readonly bidiLevel: number
  readonly paragraphLevel: 0 | 1
  readonly style: TextStyle
  script: string
}

function invalid(message: string, start?: number, end?: number): never {
  throw new TextPreparationError('invalid-input', message, {
    ...(start === undefined ? {} : { start }),
    ...(end === undefined ? {} : { end }),
  })
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value) || Object.is(value, -0)) invalid(`${label} must be finite`)
  return value
}

function validUtf16(text: string): void {
  for (let index = 0; index < text.length; index += 1) {
    const value = text.charCodeAt(index)
    if (value >= 0xd800 && value <= 0xdbff) {
      const next = text.charCodeAt(index + 1)
      if (!(next >= 0xdc00 && next <= 0xdfff)) invalid('text contains an unpaired surrogate')
      index += 1
    } else if (value >= 0xdc00 && value <= 0xdfff) {
      invalid('text contains an unpaired surrogate')
    }
  }
}

function normalizeStrings(value: unknown, label: string, allowEmpty = false): readonly string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    invalid(`${label} must be ${allowEmpty ? 'an' : 'a non-empty'} array`)
  }
  const values = value.map((item) => {
    if (typeof item !== 'string' || item.length === 0) invalid(`${label} has an invalid value`)
    return item
  })
  return Object.freeze(values)
}

function normalizeVariations(value: unknown, label: string): Readonly<Record<string, number>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid(`${label} must be a record`)
  }
  return Object.freeze(
    Object.fromEntries(
      Object.entries(value)
        .map(([key, axisValue]) => {
          if (!AXIS.test(key)) invalid(`${label} has an invalid axis`)
          if (typeof axisValue !== 'number') invalid(`${label}.${key} must be a number`)
          return [key, finite(axisValue, `${label}.${key}`)] as const
        })
        .sort(([left], [right]) => left.localeCompare(right)),
    ),
  )
}

function normalizeStyle(value: unknown, label: string): TextStyle {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid(`${label} must be an object`)
  }
  const style = value as Partial<TextStyle>
  if (typeof style.key !== 'string' || style.key.length === 0) {
    invalid(`${label}.key must be non-empty`)
  }
  const fontKeys = normalizeStrings(style.fontKeys, `${label}.fontKeys`)
  if (new Set(fontKeys).size !== fontKeys.length) invalid(`${label}.fontKeys must be unique`)
  if (typeof style.fontSize !== 'number') invalid(`${label}.fontSize must be a number`)
  const fontSize = finite(style.fontSize, `${label}.fontSize`)
  if (fontSize <= 0) invalid(`${label}.fontSize must be positive`)
  if (typeof style.language !== 'string' || !LANGUAGE.test(style.language)) {
    invalid(`${label}.language must be an ASCII language tag`)
  }
  return Object.freeze({
    key: style.key,
    fontKeys,
    fontSize,
    language: style.language,
    features: normalizeStrings(style.features ?? [], `${label}.features`, true),
    variations: normalizeVariations(style.variations ?? {}, `${label}.variations`),
  })
}

function validAnchor(value: unknown, label: string, keywords: readonly string[]): void {
  if (typeof value === 'number') {
    finite(value, label)
    return
  }
  if (typeof value !== 'string') invalid(`${label} is invalid`)
  if (keywords.includes(value)) return
  if (
    value.trim() !== value ||
    !value.endsWith('%') ||
    !Number.isFinite(Number(value.slice(0, -1)))
  ) {
    invalid(`${label} is invalid`)
  }
}

function normalizeLayout(value: unknown, complete = false): LayoutPolicy {
  if (
    value !== undefined &&
    (typeof value !== 'object' || value === null || Array.isArray(value))
  ) {
    invalid('layout must be an object')
  }
  if (complete) {
    for (const key of Object.keys(DEFAULT_LAYOUT)) {
      if (!Object.hasOwn(value as object, key)) invalid(`layout.${key} is required`)
    }
  }
  const layout = { ...DEFAULT_LAYOUT, ...(value as Partial<LayoutPolicy> | undefined) }
  if (layout.maxWidth !== null) {
    if (typeof layout.maxWidth !== 'number') invalid('layout.maxWidth must be a number or null')
    if (finite(layout.maxWidth, 'layout.maxWidth') < 0)
      invalid('layout.maxWidth must not be negative')
  }
  if (!['normal', 'nowrap'].includes(layout.whiteSpace)) invalid('layout.whiteSpace is invalid')
  if (!['normal', 'break-word'].includes(layout.overflowWrap)) {
    invalid('layout.overflowWrap is invalid')
  }
  if (!['left', 'center', 'right', 'justify'].includes(layout.textAlign)) {
    invalid('layout.textAlign is invalid')
  }
  if (typeof layout.textIndent !== 'number') invalid('layout.textIndent must be a number')
  if (typeof layout.letterSpacing !== 'number') invalid('layout.letterSpacing must be a number')
  finite(layout.textIndent, 'layout.textIndent')
  finite(layout.letterSpacing, 'layout.letterSpacing')
  if (layout.lineHeight !== 'normal') {
    if (typeof layout.lineHeight !== 'number') invalid('layout.lineHeight is invalid')
    if (finite(layout.lineHeight, 'layout.lineHeight') < 0) {
      invalid('layout.lineHeight must not be negative')
    }
  }
  validAnchor(layout.anchorX, 'layout.anchorX', ['left', 'center', 'right'])
  validAnchor(layout.anchorY, 'layout.anchorY', [
    'top',
    'top-baseline',
    'top-cap',
    'top-ex',
    'middle',
    'bottom',
    'bottom-baseline',
  ])
  return Object.freeze(layout)
}

function normalizeDirection(value: unknown): ParagraphDirection {
  if (value === undefined) return 'auto'
  if (value !== 'auto' && value !== 'ltr' && value !== 'rtl') {
    invalid('paragraphDirection is invalid')
  }
  return value
}

function graphemeBoundaries(text: string): ReadonlySet<number> {
  const boundaries = new Set<number>([0, text.length])
  for (const grapheme of segmenter.segment(text)) {
    boundaries.add(grapheme.index)
    boundaries.add(grapheme.index + grapheme.segment.length)
  }
  return boundaries
}

function normalizeRanges(
  text: string,
  ranges: readonly TextStyleRange[] | undefined,
  boundaries: ReadonlySet<number>,
): readonly TextStyleRange[] {
  if (ranges !== undefined && !Array.isArray(ranges)) invalid('styleRanges must be an array')
  const normalized = (ranges ?? [])
    .map((range, index) => {
      if (
        !range ||
        !Number.isInteger(range.start) ||
        !Number.isInteger(range.end) ||
        range.start < 0 ||
        range.start >= range.end ||
        range.end > text.length ||
        !boundaries.has(range.start) ||
        !boundaries.has(range.end)
      ) {
        invalid(`styleRanges[${index}] must follow grapheme boundaries`, range?.start, range?.end)
      }
      return Object.freeze({
        start: range.start,
        end: range.end,
        style: normalizeStyle(range.style, `styleRanges[${index}].style`),
      })
    })
    .sort((left, right) => left.start - right.start)
  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1]
    const current = normalized[index]
    if (previous && current && current.start < previous.end)
      invalid('style ranges must not overlap')
  }
  return Object.freeze(normalized)
}

function styleAt(
  offset: number,
  fallback: TextStyle,
  ranges: readonly TextStyleRange[],
): TextStyle {
  return ranges.find((range) => range.start <= offset && offset < range.end)?.style ?? fallback
}

function rawScript(text: string): string {
  for (const character of text) {
    const script = unicodeScriptCode(character) ?? 'Zzzz'
    if (STRONG_SCRIPT.test(script)) return script
  }
  return 'Zyyy'
}

function scriptCandidate(index: number, direction: -1 | 1, clusters: readonly Cluster[]): string {
  const level = clusters[index]?.bidiLevel
  index += direction
  while (index >= 0 && index < clusters.length) {
    const candidate = clusters[index]
    if (!candidate || HARD_BREAK.test(candidate.text)) return 'Zyyy'
    if (STRONG_SCRIPT.test(candidate.script) && candidate.bidiLevel % 2 === (level ?? 0) % 2) {
      return candidate.script
    }
    index += direction
  }
  return 'Zyyy'
}

function adoptScripts(clusters: Cluster[]): void {
  for (const [index, cluster] of clusters.entries()) {
    if (STRONG_SCRIPT.test(cluster.script) || HARD_BREAK.test(cluster.text)) continue
    const extensions = unicodeScriptExtensionCodes(cluster.text)
    const previous = scriptCandidate(index, -1, clusters)
    const next = scriptCandidate(index, 1, clusters)
    cluster.script =
      (STRONG_SCRIPT.test(previous) && extensions.has(previous) && previous) ||
      (STRONG_SCRIPT.test(next) && extensions.has(next) && next) ||
      (previous !== 'Zyyy' && previous) ||
      next
  }
}

function equalRecord(
  left: Readonly<Record<string, number>>,
  right: Readonly<Record<string, number>>,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function compatible(left: PreparedSegment, right: PreparedSegment): boolean {
  return (
    left.end === right.start &&
    left.paragraphLevel === right.paragraphLevel &&
    left.bidiLevel === right.bidiLevel &&
    left.direction === right.direction &&
    left.script === right.script &&
    left.styleKey === right.styleKey &&
    left.fontSize === right.fontSize &&
    left.language === right.language &&
    left.fontKeys.join('\0') === right.fontKeys.join('\0') &&
    left.features.join('\0') === right.features.join('\0') &&
    equalRecord(left.variations, right.variations)
  )
}

function normalizeSegment(
  value: unknown,
  index: number,
  text: string,
  boundaries: ReadonlySet<number>,
): PreparedSegment {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid(`segments[${index}] must be an object`)
  }
  const segment = value as Partial<PreparedSegment>
  if (
    !Number.isInteger(segment.start) ||
    !Number.isInteger(segment.end) ||
    (segment.start ?? -1) < 0 ||
    (segment.start ?? 0) >= (segment.end ?? 0) ||
    (segment.end ?? 0) > text.length ||
    !boundaries.has(segment.start ?? -1) ||
    !boundaries.has(segment.end ?? -1)
  ) {
    invalid(`segments[${index}] has an invalid grapheme range`, segment.start, segment.end)
  }
  const start = segment.start as number
  const end = segment.end as number
  if (HARD_BREAK.test(text.slice(start, end))) {
    invalid(`segments[${index}] crosses a hard break`, start, end)
  }
  if (segment.paragraphLevel !== 0 && segment.paragraphLevel !== 1) {
    invalid(`segments[${index}].paragraphLevel is invalid`, start, end)
  }
  if (!Number.isInteger(segment.bidiLevel) || (segment.bidiLevel ?? -1) < 0) {
    invalid(`segments[${index}].bidiLevel is invalid`, start, end)
  }
  if (segment.direction !== 'ltr' && segment.direction !== 'rtl') {
    invalid(`segments[${index}].direction is invalid`, start, end)
  }
  if ((segment.bidiLevel as number) % 2 !== (segment.direction === 'rtl' ? 1 : 0)) {
    invalid(`segments[${index}].direction does not match bidiLevel`, start, end)
  }
  if (typeof segment.script !== 'string' || !SCRIPT.test(segment.script)) {
    invalid(`segments[${index}].script is invalid`, start, end)
  }
  if (typeof segment.styleKey !== 'string' || segment.styleKey.length === 0) {
    invalid(`segments[${index}].styleKey is invalid`, start, end)
  }
  const fontKeys = normalizeStrings(segment.fontKeys, `segments[${index}].fontKeys`)
  if (new Set(fontKeys).size !== fontKeys.length) {
    invalid(`segments[${index}].fontKeys must be unique`, start, end)
  }
  if (typeof segment.fontSize !== 'number') {
    invalid(`segments[${index}].fontSize must be a number`, start, end)
  }
  const fontSize = finite(segment.fontSize, `segments[${index}].fontSize`)
  if (fontSize <= 0) invalid(`segments[${index}].fontSize must be positive`, start, end)
  if (typeof segment.language !== 'string' || !LANGUAGE.test(segment.language)) {
    invalid(`segments[${index}].language is invalid`, start, end)
  }
  return Object.freeze({
    start,
    end,
    paragraphLevel: segment.paragraphLevel,
    bidiLevel: segment.bidiLevel as number,
    direction: segment.direction,
    script: segment.script,
    styleKey: segment.styleKey,
    fontKeys,
    fontSize,
    language: segment.language,
    features: normalizeStrings(segment.features, `segments[${index}].features`, true),
    variations: normalizeVariations(segment.variations, `segments[${index}].variations`),
  })
}

function normalizeBreakOpportunities(
  value: unknown,
  text: string,
  boundaries: ReadonlySet<number>,
): readonly LineBreakOpportunity[] {
  if (!Array.isArray(value)) invalid('breakOpportunities must be an array')
  const required = mandatoryLineBreakBoundaries(text)
  let previous = -1
  const opportunities = value.map((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      invalid(`breakOpportunities[${index}] must be an object`)
    }
    const opportunity = item as Partial<LineBreakOpportunity>
    if (
      !Number.isInteger(opportunity.position) ||
      (opportunity.position ?? -1) < 0 ||
      (opportunity.position ?? 0) > text.length ||
      !boundaries.has(opportunity.position ?? -1)
    ) {
      invalid(`breakOpportunities[${index}].position must be a grapheme boundary`)
    }
    const position = opportunity.position as number
    if (position <= previous) {
      invalid('breakOpportunities must be ordered and unique')
    }
    if (typeof opportunity.required !== 'boolean') {
      invalid(`breakOpportunities[${index}].required must be boolean`)
    }
    if (opportunity.required !== required.has(position)) {
      invalid(`breakOpportunities[${index}].required does not match the source control`)
    }
    previous = position
    return Object.freeze({ position, required: opportunity.required })
  })
  if (opportunities.at(-1)?.position !== text.length) {
    invalid('breakOpportunities must contain one terminal boundary')
  }
  for (const position of required) {
    if (!opportunities.some((opportunity) => opportunity.position === position)) {
      invalid(`breakOpportunities are missing required boundary ${position}`)
    }
  }
  return Object.freeze(opportunities)
}

/**
 * Re-validates a {@link PreparedText} and returns a frozen, normalized copy.
 *
 * Called by {@link layoutPreparedText} on every entry, which is what makes it
 * safe to hand back a value that has been serialized, stored, and parsed: the
 * schema version, UTF-16 well-formedness, segment ordering and coverage, and
 * break-opportunity boundaries are all re-checked rather than trusted.
 */
export function validatePreparedText(value: PreparedText): PreparedText {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid('prepared text must be an object')
  }
  if (value.schemaVersion !== 2) invalid('prepared text schemaVersion must be 2')
  if (typeof value.text !== 'string') invalid('prepared text must contain text')
  validUtf16(value.text)
  if (value.paragraphDirection === undefined)
    invalid('prepared text paragraphDirection is required')
  const direction = normalizeDirection(value.paragraphDirection)
  const defaultStyle = normalizeStyle(value.defaultStyle, 'defaultStyle')
  const layout = normalizeLayout(value.layout, true)
  if (!Array.isArray(value.segments)) invalid('segments must be an array')
  const boundaries = graphemeBoundaries(value.text)
  const breakOpportunities = normalizeBreakOpportunities(
    value.breakOpportunities,
    value.text,
    boundaries,
  )
  const coverage = new Uint8Array(value.text.length)
  let previousEnd = 0
  const segments = value.segments.map((segment, index) => {
    const normalized = normalizeSegment(segment, index, value.text, boundaries)
    if (normalized.start < previousEnd) invalid(`segments[${index}] overlaps the previous segment`)
    previousEnd = normalized.end
    coverage.fill(1, normalized.start, normalized.end)
    return normalized
  })
  for (let index = 0; index < value.text.length; index += 1) {
    if (!HARD_BREAK.test(value.text[index] ?? '') && coverage[index] === 0) {
      invalid(`source offset ${index} is not covered by a prepared segment`, index, index + 1)
    }
  }
  return Object.freeze({
    schemaVersion: 2,
    text: value.text,
    paragraphDirection: direction,
    defaultStyle,
    layout,
    segments: Object.freeze(segments),
    breakOpportunities,
  })
}

/**
 * Performs all font-independent text analysis: bidi resolution, grapheme
 * segmentation, script itemization, style intersection, and Unicode
 * line-breaking.
 *
 * @remarks
 * This is the half of layout that depends only on the text, and it is the
 * expensive half. The returned {@link PreparedText} is deeply frozen plain JSON,
 * so it can be cached, stored, or transferred across a worker boundary and
 * later reused by {@link layoutPreparedText} with any structurally equivalent
 * font registry.
 *
 * No font is consulted here, which is exactly why the result survives a font
 * swap. Note that layout policy *is* captured in the result, so changing
 * `maxWidth` or alignment requires re-preparing.
 *
 * Break opportunities come from the Unicode line-breaking algorithm (Unicode 13
 * data). That is not complete browser CSS behavior — dictionary segmentation
 * for scripts such as Thai, automatic hyphenation, and CSS `line-break`
 * tailoring are outside this package.
 *
 * @param input - Text, base direction, default style, optional style ranges,
 *   and optional layout policy.
 * @returns A frozen, serializable preparation record.
 * @throws {@link TextPreparationError} with `code: 'invalid-input'` for
 *   unpaired surrogates, style ranges that overlap or fall off grapheme
 *   boundaries, or malformed policy values.
 *
 * @example
 * Bidirectional text itemizes into per-direction segments.
 * ```typescript
 * const prepared = prepareText({
 *   text: 'Hello مرحبا',
 *   style: { key: 'body', fontKeys: ['latin', 'arabic'], fontSize: 24, language: 'und' },
 *   layout: { maxWidth: 320 },
 * })
 * prepared.segments.length // 2 — Latn ltr [0,6), Arab rtl [6,11)
 * prepared.schemaVersion // 2
 * JSON.parse(JSON.stringify(prepared)) // round-trips for caching or transfer
 * ```
 */
export function prepareText(input: PrepareTextInput): PreparedText {
  if (typeof input !== 'object' || input === null || typeof input.text !== 'string') {
    invalid('input.text must be a string')
  }
  validUtf16(input.text)
  const direction = normalizeDirection(input.paragraphDirection)
  const defaultStyle = normalizeStyle(input.style, 'style')
  const boundaries = graphemeBoundaries(input.text)
  const ranges = normalizeRanges(input.text, input.styleRanges, boundaries)
  const embedding = bidi.getEmbeddingLevels(
    input.text,
    direction === 'auto' ? undefined : direction,
  )
  const defaultLevel: 0 | 1 = direction === 'rtl' ? 1 : 0
  const clusters: Cluster[] = [...segmenter.segment(input.text)].map((grapheme) => {
    const paragraph = embedding.paragraphs.find(
      (item) => item.start <= grapheme.index && grapheme.index <= item.end,
    )
    const level = embedding.levels[grapheme.index] ?? paragraph?.level ?? defaultLevel
    return {
      start: grapheme.index,
      end: grapheme.index + grapheme.segment.length,
      text: grapheme.segment,
      bidiLevel: level,
      paragraphLevel: paragraph?.level ?? defaultLevel,
      style: styleAt(grapheme.index, defaultStyle, ranges),
      script: rawScript(grapheme.segment),
    }
  })
  adoptScripts(clusters)

  const segments: PreparedSegment[] = []
  for (const cluster of clusters) {
    if (HARD_BREAK.test(cluster.text)) continue
    const segment: PreparedSegment = Object.freeze({
      start: cluster.start,
      end: cluster.end,
      paragraphLevel: cluster.paragraphLevel,
      bidiLevel: cluster.bidiLevel,
      direction: cluster.bidiLevel % 2 === 0 ? 'ltr' : 'rtl',
      script: cluster.script,
      styleKey: cluster.style.key,
      fontKeys: cluster.style.fontKeys,
      fontSize: cluster.style.fontSize,
      language: cluster.style.language,
      features: cluster.style.features ?? Object.freeze([]),
      variations: cluster.style.variations ?? Object.freeze({}),
    })
    const previous = segments.at(-1)
    if (previous && compatible(previous, segment)) {
      segments[segments.length - 1] = Object.freeze({ ...previous, end: segment.end })
    } else {
      segments.push(segment)
    }
  }

  return Object.freeze({
    schemaVersion: 2,
    text: input.text,
    paragraphDirection: direction,
    defaultStyle,
    layout: normalizeLayout(input.layout),
    segments: Object.freeze(segments),
    breakOpportunities: lineBreakOpportunities(input.text),
  })
}

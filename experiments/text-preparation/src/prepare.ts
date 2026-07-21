import bidiFactory from 'bidi-js'
import { unicodeScriptCode, unicodeScriptExtensionCodes } from 'unicode-script'
import { PreparationError } from './errors.js'
import type {
  LayoutPolicy,
  ParagraphDirection,
  PreparedSegment,
  PreparedText,
  PrepareTextInput,
  TextStyle,
  TextStyleRange,
} from './types.js'

const bidi = bidiFactory()
const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' })
const HARD_BREAK = /[\r\n]/u
const STRONG_SCRIPT = /^(?!Zyyy$|Zinh$|Zzzz$)[A-Z][a-z]{3}$/

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
  throw new PreparationError('invalid-input', message, {
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

function normalizeStyle(style: TextStyle, label: string): TextStyle {
  if (!style || typeof style !== 'object') invalid(`${label} must be an object`)
  if (!style.key) invalid(`${label}.key must be non-empty`)
  if (!Array.isArray(style.fontKeys) || style.fontKeys.length === 0) {
    invalid(`${label}.fontKeys must be a non-empty array`)
  }
  const fontKeys = style.fontKeys.map((key) => {
    if (typeof key !== 'string' || key.length === 0) invalid(`${label}.fontKeys must be non-empty`)
    return key
  })
  if (new Set(fontKeys).size !== fontKeys.length) invalid(`${label}.fontKeys must be unique`)
  const fontSize = finite(style.fontSize, `${label}.fontSize`)
  if (fontSize <= 0) invalid(`${label}.fontSize must be positive`)
  if (!/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(style.language)) {
    invalid(`${label}.language must be an ASCII language tag`)
  }
  const features = (style.features ?? []).map((feature) => {
    if (typeof feature !== 'string' || feature.length === 0) {
      invalid(`${label}.features must contain non-empty strings`)
    }
    return feature
  })
  const variations = Object.fromEntries(
    Object.entries(style.variations ?? {})
      .map(([key, value]) => {
        if (!/^[\x20-\x7e]{4}$/.test(key)) invalid(`${label}.variations has an invalid axis`)
        return [key, finite(value, `${label}.variations.${key}`)] as const
      })
      .sort(([left], [right]) => left.localeCompare(right)),
  )
  return Object.freeze({
    key: style.key,
    fontKeys: Object.freeze(fontKeys),
    fontSize,
    language: style.language,
    features: Object.freeze(features),
    variations: Object.freeze(variations),
  })
}

function normalizeLayout(input: PrepareTextInput['layout']): LayoutPolicy {
  const layout = { ...DEFAULT_LAYOUT, ...input }
  if (layout.maxWidth !== null && finite(layout.maxWidth, 'layout.maxWidth') < 0) {
    invalid('layout.maxWidth must not be negative')
  }
  if (!['normal', 'nowrap'].includes(layout.whiteSpace)) invalid('layout.whiteSpace is invalid')
  if (!['normal', 'break-word'].includes(layout.overflowWrap)) {
    invalid('layout.overflowWrap is invalid')
  }
  if (!['left', 'center', 'right', 'justify'].includes(layout.textAlign)) {
    invalid('layout.textAlign is invalid')
  }
  finite(layout.textIndent, 'layout.textIndent')
  finite(layout.letterSpacing, 'layout.letterSpacing')
  if (layout.lineHeight !== 'normal' && finite(layout.lineHeight, 'layout.lineHeight') < 0) {
    invalid('layout.lineHeight must not be negative')
  }
  if (typeof layout.anchorX === 'number') finite(layout.anchorX, 'layout.anchorX')
  if (typeof layout.anchorY === 'number') finite(layout.anchorY, 'layout.anchorY')
  return Object.freeze(layout)
}

function paragraphDirection(value: ParagraphDirection | undefined): ParagraphDirection {
  if (value === undefined) return 'auto'
  if (!['auto', 'ltr', 'rtl'].includes(value)) invalid('paragraphDirection is invalid')
  return value
}

function normalizeRanges(
  text: string,
  ranges: readonly TextStyleRange[] | undefined,
  boundaries: ReadonlySet<number>,
): readonly TextStyleRange[] {
  const normalized = (ranges ?? [])
    .map((range, index) => {
      if (
        !Number.isInteger(range.start) ||
        !Number.isInteger(range.end) ||
        range.start < 0 ||
        range.start >= range.end ||
        range.end > text.length ||
        !boundaries.has(range.start) ||
        !boundaries.has(range.end)
      ) {
        invalid(`styleRanges[${index}] must follow grapheme boundaries`, range.start, range.end)
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

function freezeSegment(value: PreparedSegment): PreparedSegment {
  return Object.freeze(value)
}

export function prepareText(input: PrepareTextInput): PreparedText {
  if (!input || typeof input !== 'object' || typeof input.text !== 'string') {
    invalid('input.text must be a string')
  }
  validUtf16(input.text)
  const direction = paragraphDirection(input.paragraphDirection)
  const defaultStyle = normalizeStyle(input.style, 'style')
  const graphemes = [...segmenter.segment(input.text)]
  const boundaries = new Set<number>([0, input.text.length])
  for (const grapheme of graphemes) {
    boundaries.add(grapheme.index)
    boundaries.add(grapheme.index + grapheme.segment.length)
  }
  const ranges = normalizeRanges(input.text, input.styleRanges, boundaries)
  const embedding = bidi.getEmbeddingLevels(
    input.text,
    direction === 'auto' ? undefined : direction,
  )
  const defaultLevel: 0 | 1 = direction === 'rtl' ? 1 : 0
  const clusters: Cluster[] = graphemes.map((grapheme) => {
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
    const segment = freezeSegment({
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
      segments[segments.length - 1] = freezeSegment({ ...previous, end: segment.end })
    } else {
      segments.push(segment)
    }
  }

  const firstParagraph = embedding.paragraphs[0]?.level ?? defaultLevel
  return Object.freeze({
    schemaVersion: 1,
    text: input.text,
    paragraphDirection: direction,
    paragraphLevel: firstParagraph,
    defaultStyle,
    layout: normalizeLayout(input.layout),
    segments: Object.freeze(segments),
  })
}

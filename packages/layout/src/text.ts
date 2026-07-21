import type { FontHandle } from '@webgpu-text/font'
import { TextPreparationError } from './errors.js'
import { layoutResolvedText } from './layout.js'
import { prepareText, validatePreparedText } from './preparation.js'
import type {
  FontRegistry,
  LayoutResult,
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
  return {
    ascender: font.facts.ascender * scale,
    descender: font.facts.descender * scale,
    lineGap: font.facts.lineGap * scale,
  }
}

function shapeSegment(segment: SelectedSegment, text: string): ResolvedShapedRun {
  const scale = segment.fontSize / segment.font.facts.unitsPerEm
  const shaped = segment.font.shape({
    text: text.slice(segment.start, segment.end),
    direction: segment.direction,
    script: segment.script,
    language: segment.language,
    features: segment.features,
    variations: segment.variations,
  })
  const glyphs: ResolvedGlyph[] = shaped.glyphs.map((glyph) => ({
    glyphId: glyph.glyphId,
    start: segment.start + glyph.clusterStart,
    end: segment.start + glyph.clusterEnd,
    xAdvance: glyph.xAdvance * scale,
    yAdvance: glyph.yAdvance * scale,
    xOffset: glyph.xOffset * scale,
    yOffset: glyph.yOffset * scale,
    flags: glyph.flags,
    bounds: null,
  }))
  return {
    start: segment.start,
    end: segment.end,
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

function defaultMetrics(
  style: TextStyle,
  fonts: FontRegistry,
  textLength: number,
): ResolvedRunMetrics {
  const first = registeredFonts(style.fontKeys, fonts, 0, textLength)[0]
  if (!first) throw new TextPreparationError('missing-font', 'default style has no font keys')
  return scaledMetrics(first.font, style.fontSize / first.font.facts.unitsPerEm)
}

export function layoutPreparedText(prepared: PreparedText, fonts: FontRegistry): LayoutResult {
  const validated = validatePreparedText(prepared)
  const fontRegistry = registry(fonts)
  const runs = selectedSegments(validated, fontRegistry).map((segment) =>
    shapeSegment(segment, validated.text),
  )
  return layoutResolvedText({
    text: validated.text,
    paragraphLevel:
      validated.segments[0]?.paragraphLevel ?? (validated.paragraphDirection === 'rtl' ? 1 : 0),
    defaultMetrics: defaultMetrics(validated.defaultStyle, fontRegistry, validated.text.length),
    ...validated.layout,
    runs,
  })
}

export function layoutText(input: PrepareTextInput, fonts: FontRegistry): LayoutResult {
  return layoutPreparedText(prepareText(input), fonts)
}

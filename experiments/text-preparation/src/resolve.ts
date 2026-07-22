import type { FontHandle } from '@webgpu-text/font'
import {
  getSelectionRects,
  layoutResolvedText,
  type ResolvedGlyph,
  type ResolvedRunMetrics,
  type ResolvedShapedRun,
} from '@webgpu-text/layout'
import { PreparationError } from './errors.js'
import { prepareText } from './prepare.js'
import type {
  CompletedText,
  FontRegistry,
  PreparedSegment,
  PreparedText,
  PrepareTextInput,
  ResolvedText,
} from './types.js'

const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' })
const COVERAGE_IGNORABLE = /\p{Default_Ignorable_Code_Point}/u

interface SelectedSegment extends PreparedSegment {
  readonly fontKey: string
  readonly font: FontHandle
}

function missingFont(segment: PreparedSegment, fontKey: string): never {
  throw new PreparationError('missing-font', `font registry has no key ${fontKey}`, {
    start: segment.start,
    end: segment.end,
    attemptedFontKeys: segment.fontKeys,
  })
}

function selectFont(
  segment: PreparedSegment,
  text: string,
  start: number,
  end: number,
  fonts: FontRegistry,
): { readonly fontKey: string; readonly font: FontHandle } {
  const candidates = segment.fontKeys.map((fontKey) => {
    const font = fonts.get(fontKey)
    if (!font) missingFont(segment, fontKey)
    return { fontKey, font }
  })
  const cluster = text.slice(start, end)
  for (const candidate of candidates) {
    const covered = [...cluster].every(
      (character) =>
        COVERAGE_IGNORABLE.test(character) ||
        candidate.font.supports(character.codePointAt(0) ?? -1),
    )
    if (covered) return candidate
  }
  throw new PreparationError(
    'missing-coverage',
    `no preferred font covers ${JSON.stringify(cluster)}`,
    {
      start,
      end,
      attemptedFontKeys: segment.fontKeys,
    },
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
    decorationMetrics: {
      underlinePosition: font.facts.decorationMetrics.underlinePosition * scale,
      underlineThickness: font.facts.decorationMetrics.underlineThickness * scale,
      strikethroughPosition: font.facts.decorationMetrics.strikethroughPosition * scale,
      strikethroughThickness: font.facts.decorationMetrics.strikethroughThickness * scale,
    },
  }
}

function scaledBounds(font: FontHandle, glyphId: number, scale: number) {
  const bounds = font.getOutline(glyphId).bounds
  if (bounds.xMin === 0 && bounds.xMax === 0 && bounds.yMin === 0 && bounds.yMax === 0) {
    return null
  }
  return {
    left: bounds.xMin * scale,
    bottom: bounds.yMin * scale,
    right: bounds.xMax * scale,
    top: bounds.yMax * scale,
  }
}

function shapeSegment(segment: SelectedSegment, text: string): ResolvedShapedRun {
  const source = text.slice(segment.start, segment.end)
  const scale = segment.fontSize / segment.font.facts.unitsPerEm
  const shaped = segment.font.shape({
    text: source,
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
    bounds: scaledBounds(segment.font, glyph.glyphId, scale),
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

function defaultMetrics(prepared: PreparedText, fonts: FontRegistry): ResolvedRunMetrics {
  const candidates = prepared.defaultStyle.fontKeys.map((fontKey) => {
    const font = fonts.get(fontKey)
    if (!font) {
      throw new PreparationError('missing-font', `font registry has no key ${fontKey}`, {
        start: 0,
        end: prepared.text.length,
        attemptedFontKeys: prepared.defaultStyle.fontKeys,
      })
    }
    return font
  })
  const font = candidates[0]
  if (!font) throw new PreparationError('missing-font', 'default style has no registered font')
  return scaledMetrics(font, prepared.defaultStyle.fontSize / font.facts.unitsPerEm)
}

export function resolvePreparedText(prepared: PreparedText, fonts: FontRegistry): ResolvedText {
  const runs = selectedSegments(prepared, fonts).map((segment) =>
    shapeSegment(segment, prepared.text),
  )
  const input = {
    text: prepared.text,
    paragraphLevel: prepared.paragraphLevel,
    defaultMetrics: defaultMetrics(prepared, fonts),
    ...prepared.layout,
    runs,
  }
  return { input, runs }
}

export function layoutPreparedText(prepared: PreparedText, fonts: FontRegistry): CompletedText {
  const resolved = resolvePreparedText(prepared, fonts)
  return { ...resolved, layout: layoutResolvedText(resolved.input) }
}

export function layoutText(input: PrepareTextInput, fonts: FontRegistry): CompletedText {
  return layoutPreparedText(prepareText(input), fonts)
}

export function selectionFor(
  completed: CompletedText,
  start: number,
  end: number,
): ReturnType<typeof getSelectionRects> {
  return getSelectionRects(completed.layout, { start, end })
}

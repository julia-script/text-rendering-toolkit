import { writeFileSync } from 'node:fs'

const output = new URL('./policy-fixtures.json', import.meta.url)
const syntheticIntegrity = 'layout-policy-schema-v1'
const troikaIntegrity = 'bca98dddeb3602b04d5452602e7da32df2fafe06'
const zero = { left: 0, bottom: 0, right: 0, top: 0 }
const baseFont = {
  fontKey: 'synthetic/base',
  ascender: 8,
  descender: -2,
  lineGap: 2,
  decorationMetrics: {
    underlinePosition: -1,
    underlineThickness: 0.5,
    strikethroughPosition: 3,
    strikethroughThickness: 0.5,
  },
}

function glyph(glyphId, start, end, xAdvance = 10, bounds = { left: 0, bottom: -2, right: 8, top: 8 }) {
  return { glyphId, start, end, xAdvance, yAdvance: 0, xOffset: 0, yOffset: 0, flags: 0, bounds }
}

function run(text, glyphs, options = {}) {
  const direction = options.direction ?? 'ltr'
  const metrics = options.metrics ?? baseFont
  return {
    start: options.start ?? 0,
    end: options.end ?? text.length,
    direction,
    bidiLevel: options.bidiLevel ?? (direction === 'rtl' ? 1 : 0),
    script: options.script ?? 'Latn',
    language: options.language ?? 'en',
    styleKey: options.styleKey ?? 'default',
    fontKey: options.fontKey ?? baseFont.fontKey,
    fontSize: options.fontSize ?? 10,
    fontUnitScale: options.fontUnitScale ?? (options.fontSize ?? 10) / 1000,
    metrics: {
      ascender: metrics.ascender,
      descender: metrics.descender,
      lineGap: metrics.lineGap,
      decorationMetrics: metrics.decorationMetrics ?? baseFont.decorationMetrics,
    },
    variations: options.variations ?? {},
    glyphs: direction === 'rtl' ? [...glyphs].reverse() : glyphs,
  }
}

function placed(source, x, y, lineIndex, options = {}) {
  return {
    start: source.start,
    end: source.end,
    fontKey: options.fontKey ?? baseFont.fontKey,
    styleKey: options.styleKey ?? 'default',
    glyphId: source.glyphId,
    variations: options.variations ?? {},
    fontUnitScale: options.fontUnitScale ?? 0.01,
    lineIndex,
    x,
    y,
    xAdvance: source.xAdvance,
    yAdvance: source.yAdvance,
    xOffset: source.xOffset,
    yOffset: source.yOffset,
    bounds: source.bounds,
  }
}

function line(start, end, glyphStart, glyphEnd, baseline, left, right, breakAfter = 'none', height = 10) {
  return {
    start,
    end,
    glyphStart,
    glyphEnd,
    baseline,
    left,
    right,
    bottom: baseline - 2,
    top: baseline + height - 2,
    breakAfter,
  }
}

function caret(offset, lineIndex, x, baseline = 0, height = 10) {
  return { offset, lineIndex, x, bottom: baseline - 2, top: baseline + height - 2 }
}

function bounds(left, bottom, right, top) {
  return { left, bottom, right, top }
}

function decorationRanges(runs) {
  const ranges = []
  for (const { start, end, metrics } of runs) {
    const current = { start, end, ...metrics.decorationMetrics }
    const previous = ranges.at(-1)
    if (
      previous &&
      previous.end === start &&
      previous.underlinePosition === current.underlinePosition &&
      previous.underlineThickness === current.underlineThickness &&
      previous.strikethroughPosition === current.strikethroughPosition &&
      previous.strikethroughThickness === current.strikethroughThickness
    ) {
      previous.end = end
    } else {
      ranges.push(current)
    }
  }
  return ranges
}

function fixture({
  id,
  intent,
  tags,
  text,
  runs,
  glyphs,
  lines,
  carets,
  blockBounds,
  visibleBounds,
  selections = [],
  input = {},
  classification = 'preserve',
  rationale = 'Renderer-neutral layout behavior remains useful independently of the old renderer.',
  source = 'synthetic fixture',
  integrity = syntheticIntegrity,
}) {
  return {
    id,
    intent,
    tags,
    classification,
    rationale,
    evidence: {
      layer: source === 'Troika reference observation' ? 'troika-reference' : 'synthetic',
      source,
      integrity,
    },
    input: {
      text,
      paragraphLevel: 0,
      defaultMetrics: {
        ascender: baseFont.ascender,
        descender: baseFont.descender,
        lineGap: baseFont.lineGap,
        decorationMetrics: baseFont.decorationMetrics,
      },
      maxWidth: null,
      whiteSpace: 'normal',
      overflowWrap: 'normal',
      textAlign: 'left',
      textIndent: 0,
      letterSpacing: 0,
      lineHeight: 'normal',
      anchorX: 0,
      anchorY: 0,
      runs,
      ...input,
    },
    expected: {
      sourceLengthUtf16: text.length,
      fontKeys: [...new Set(runs.map((item) => item.fontKey))],
      glyphs,
      lines,
      carets,
      defaultDecorationMetrics: baseFont.decorationMetrics,
      decorationMetrics: decorationRanges(runs),
      blockBounds,
      visibleBounds,
    },
    selections,
  }
}

const fixtures = []

fixtures.push(
  fixture({
    id: 'line-empty-input',
    intent: 'Represent empty input with one editable empty line and deterministic zero bounds.',
    tags: ['line-construction', 'empty-input', 'carets', 'bounds'],
    text: '',
    runs: [],
    glyphs: [],
    lines: [line(0, 0, 0, 0, 0, 0, 0)],
    carets: [caret(0, 0, 0)],
    blockBounds: zero,
    visibleBounds: null,
  }),
)

{
  const text = 'A\r\n\rB\n'
  const a = glyph(65, 0, 1)
  const b = glyph(66, 4, 5)
  fixtures.push(
    fixture({
      id: 'line-empty-and-breaks',
      intent: 'Treat CRLF as one hard break, preserve source indices, and retain explicit empty lines.',
      tags: ['line-construction', 'newlines', 'empty-lines', 'utf16'],
      text,
      runs: [run(text, [a, b])],
      glyphs: [placed(a, 0, 0, 0), placed(b, 0, -24, 2)],
      lines: [
        line(0, 3, 0, 1, 0, 0, 10, 'hard'),
        line(3, 4, 1, 1, -12, 0, 0, 'hard'),
        line(4, 6, 1, 2, -24, 0, 10, 'hard'),
        line(6, 6, 2, 2, -36, 0, 0),
      ],
      carets: [caret(0, 0, 0), caret(1, 0, 10), caret(3, 1, 0, -12), caret(4, 2, 0, -24), caret(5, 2, 10, -24), caret(6, 3, 0, -36)],
      blockBounds: bounds(0, -38, 10, 8),
      visibleBounds: bounds(0, -26, 8, 8),
      classification: 'intentional-change',
      rationale: 'Keep original UTF-16 indices while treating CRLF as one break; Troika normalizes and shortens the string.',
      source: 'Troika reference observation',
      integrity: troikaIntegrity,
    }),
  )
}

{
  const text = 'A  '
  const a = glyph(65, 0, 1)
  const spaces = [glyph(32, 1, 2, 5, null), glyph(32, 2, 3, 5, null)]
  fixtures.push(
    fixture({
      id: 'line-trailing-whitespace',
      intent: 'Exclude trailing whitespace from line and block width while retaining caret advances.',
      tags: ['line-construction', 'whitespace', 'bounds'],
      text,
      runs: [run(text, [a, ...spaces])],
      glyphs: [placed(a, 0, 0, 0)],
      lines: [line(0, 3, 0, 1, 0, 0, 10)],
      carets: [caret(0, 0, 0), caret(1, 0, 10), caret(2, 0, 15), caret(3, 0, 20)],
      blockBounds: bounds(0, -2, 10, 8),
      visibleBounds: bounds(0, -2, 8, 8),
    }),
  )
}

{
  const text = 'A A'
  const a1 = glyph(65, 0, 1)
  const space = glyph(32, 1, 2, 5, null)
  const a2 = glyph(65, 2, 3)
  fixtures.push(
    fixture({
      id: 'wrap-normal-soft',
      intent: 'Soft-wrap after whitespace when the next visible glyph exceeds the finite width.',
      tags: ['wrapping', 'soft-break', 'finite-width'],
      text,
      runs: [run(text, [a1, space, a2])],
      glyphs: [placed(a1, 0, 0, 0), placed(a2, 0, -12, 1)],
      lines: [line(0, 2, 0, 1, 0, 0, 10, 'soft'), line(2, 3, 1, 2, -12, 0, 10)],
      carets: [caret(0, 0, 0), caret(1, 0, 10), caret(2, 1, 0, -12), caret(3, 1, 10, -12)],
      blockBounds: bounds(0, -14, 15, 8),
      visibleBounds: bounds(0, -14, 8, 8),
      input: { maxWidth: 15 },
    }),
  )
}

{
  const text = 'AAA'
  const inputGlyphs = [glyph(65, 0, 1), glyph(65, 1, 2), glyph(65, 2, 3)]
  fixtures.push(
    fixture({
      id: 'wrap-nowrap-overflow',
      intent: 'Allow a no-wrap line and an unbreakable run to exceed maxWidth without changing glyph order.',
      tags: ['wrapping', 'nowrap', 'overflow', 'unbreakable'],
      text,
      runs: [run(text, inputGlyphs)],
      glyphs: inputGlyphs.map((item, index) => placed(item, index * 10, 0, 0)),
      lines: [line(0, 3, 0, 3, 0, 0, 30)],
      carets: [caret(0, 0, 0), caret(1, 0, 10), caret(2, 0, 20), caret(3, 0, 30)],
      blockBounds: bounds(0, -2, 30, 8),
      visibleBounds: bounds(0, -2, 28, 8),
      input: { maxWidth: 15, whiteSpace: 'nowrap' },
    }),
  )
}

{
  const text = 'AAA'
  const inputGlyphs = [glyph(65, 0, 1), glyph(65, 1, 2), glyph(65, 2, 3)]
  fixtures.push(
    fixture({
      id: 'wrap-break-word-indent',
      intent: 'Apply indentation before break-word overflow and reset it on the continuation line.',
      tags: ['wrapping', 'break-word', 'indentation', 'hard-overflow'],
      text,
      runs: [run(text, inputGlyphs)],
      glyphs: [placed(inputGlyphs[0], 5, 0, 0), placed(inputGlyphs[1], 0, -12, 1), placed(inputGlyphs[2], 10, -12, 1)],
      lines: [line(0, 1, 0, 1, 0, 5, 15, 'soft'), line(1, 3, 1, 3, -12, 0, 20)],
      carets: [caret(0, 0, 5), caret(1, 1, 0, -12), caret(2, 1, 10, -12), caret(3, 1, 20, -12)],
      blockBounds: bounds(0, -14, 20, 8),
      visibleBounds: bounds(0, -14, 18, 8),
      input: { maxWidth: 20, overflowWrap: 'break-word', textIndent: 5 },
    }),
  )
}

{
  const text = 'AB'
  const tallFont = {
    fontKey: 'synthetic/tall',
    ascender: 12,
    descender: -4,
    lineGap: 4,
    decorationMetrics: {
      underlinePosition: -1.5,
      underlineThickness: 0.75,
      strikethroughPosition: 4,
      strikethroughThickness: 0.75,
    },
  }
  const a = glyph(65, 0, 1, 12)
  const b = glyph(66, 1, 2, 16, { left: 0, bottom: -4, right: 14, top: 12 })
  fixtures.push(
    fixture({
      id: 'metrics-spacing-baseline',
      intent: 'Use the tallest participating metrics and apply letter spacing after each shaped advance.',
      tags: ['metrics', 'letter-spacing', 'line-height', 'font-size', 'baseline'],
      text,
      runs: [run(text, [a], { start: 0, end: 1 }), run(text, [b], { start: 1, end: 2, fontKey: tallFont.fontKey, fontSize: 16, styleKey: 'large', metrics: tallFont })],
      glyphs: [placed(a, 0, 0, 0), placed(b, 14, 0, 0, { fontKey: tallFont.fontKey, styleKey: 'large', fontUnitScale: 0.016 })],
      lines: [line(0, 2, 0, 2, 0, 0, 30, 'none', 16)],
      carets: [caret(0, 0, 0, 0, 16), caret(1, 0, 14, 0, 16), caret(2, 0, 30, 0, 16)],
      blockBounds: bounds(0, -4, 30, 12),
      visibleBounds: bounds(0, -4, 28, 12),
      input: { letterSpacing: 2, lineHeight: 16 },
    }),
  )
}

for (const [id, align, x] of [
  ['align-left', 'left', 0],
  ['align-center', 'center', 10],
  ['align-right', 'right', 20],
]) {
  const text = 'A'
  const a = glyph(65, 0, 1)
  fixtures.push(
    fixture({
      id,
      intent: `${align} alignment translates a ten-unit line within a thirty-unit block.`,
      tags: ['alignment', align],
      text,
      runs: [run(text, [a])],
      glyphs: [placed(a, x, 0, 0)],
      lines: [line(0, 1, 0, 1, 0, x, x + 10)],
      carets: [caret(0, 0, x), caret(1, 0, x + 10)],
      blockBounds: bounds(0, -2, 30, 8),
      visibleBounds: bounds(x, -2, x + 8, 8),
      input: { maxWidth: 30, textAlign: align },
    }),
  )
}

{
  const text = 'A A '
  const values = [glyph(65, 0, 1), glyph(32, 1, 2, 5, null), glyph(65, 2, 3), glyph(32, 3, 4, 5, null)]
  fixtures.push(
    fixture({
      id: 'align-justify',
      intent: 'Expand internal whitespace on a soft-wrapped justified line but exclude trailing whitespace.',
      tags: ['alignment', 'justify', 'whitespace'],
      text,
      runs: [run(text, values)],
      glyphs: [placed(values[0], 0, 0, 0), placed(values[2], 30, 0, 0)],
      lines: [line(0, 4, 0, 2, 0, 0, 40, 'soft')],
      carets: [caret(0, 0, 0), caret(1, 0, 10), caret(2, 0, 30), caret(3, 0, 40), caret(4, 0, 45)],
      blockBounds: bounds(0, -2, 40, 8),
      visibleBounds: bounds(0, -2, 38, 8),
      input: { maxWidth: 40, textAlign: 'justify' },
    }),
  )
}

{
  const text = 'A'
  const a = glyph(65, 0, 1)
  fixtures.push(
    fixture({
      id: 'anchor-numeric-keyword-percent',
      intent: 'Apply one shared anchor translation to layout and interaction geometry.',
      tags: ['anchors', 'numeric', 'keyword', 'percentage'],
      text,
      runs: [run(text, [a])],
      glyphs: [placed(a, -5, 5, 0)],
      lines: [{ ...line(0, 1, 0, 1, 5, -5, 5), bottom: 3, top: 13 }],
      carets: [caret(0, 0, -5, 5), caret(1, 0, 5, 5)],
      blockBounds: bounds(-5, 3, 5, 13),
      visibleBounds: bounds(-5, 3, 3, 13),
      selections: [{ query: { start: 0, end: 1 }, rects: [{ lineIndex: 0, left: -5, bottom: 3, right: 5, top: 13 }] }],
      input: { anchorX: '50%', anchorY: 5 },
    }),
  )
}

{
  const text = 'Aאב\nB'
  const latinA = glyph(65, 0, 1)
  const alef = glyph(1488, 1, 2)
  const bet = glyph(1489, 2, 3)
  const latinB = glyph(66, 4, 5)
  fixtures.push(
    fixture({
      id: 'bidi-ltr-rtl-multiline',
      intent: 'Keep logical ranges while placing explicit LTR and RTL runs in visual line order.',
      tags: ['bidi', 'ltr', 'rtl', 'multiline'],
      text,
      runs: [run(text, [latinA], { start: 0, end: 1 }), run(text, [alef, bet], { start: 1, end: 3, direction: 'rtl', script: 'Hebr', language: 'he' }), run(text, [latinB], { start: 4, end: 5 })],
      glyphs: [placed(latinA, 0, 0, 0), placed(alef, 20, 0, 0), placed(bet, 10, 0, 0), placed(latinB, 0, -12, 1)],
      lines: [line(0, 4, 0, 3, 0, 0, 30, 'hard'), line(4, 5, 3, 4, -12, 0, 10)],
      carets: [caret(0, 0, 0), caret(1, 0, 10), caret(2, 0, 20), caret(3, 0, 10), caret(4, 1, 0, -12), caret(5, 1, 10, -12)],
      blockBounds: bounds(0, -14, 30, 8),
      visibleBounds: bounds(0, -14, 28, 8),
    }),
  )
}

{
  const text = 'AB'
  const a = glyph(65, 0, 1)
  const b = glyph(66, 1, 2, 12)
  fixtures.push(
    fixture({
      id: 'runs-style-size-language',
      intent: 'Split style, size, language, and variation values at valid UTF-16 boundaries.',
      tags: ['runs', 'style', 'size', 'language', 'variations'],
      text,
      runs: [run(text, [a], { start: 0, end: 1 }), run(text, [b], { start: 1, end: 2, styleKey: 'emphasis', fontSize: 14, language: 'fr', variations: { wght: 700 }, metrics: { ascender: 12, descender: -2, lineGap: 0, decorationMetrics: { underlinePosition: -1.4, underlineThickness: 0.7, strikethroughPosition: 4.2, strikethroughThickness: 0.7 } } })],
      glyphs: [placed(a, 0, 0, 0), placed(b, 10, 0, 0, { styleKey: 'emphasis', variations: { wght: 700 }, fontUnitScale: 0.014 })],
      lines: [line(0, 2, 0, 2, 0, 0, 22, 'none', 14)],
      carets: [caret(0, 0, 0, 0, 14), caret(1, 0, 10, 0, 14), caret(2, 0, 22, 0, 14)],
      blockBounds: bounds(0, -2, 22, 12),
      visibleBounds: bounds(0, -2, 18, 8),
      classification: 'intentional-change',
      rationale: 'Preserve style behavior while replacing mutable start-index maps with half-open spans and stable style keys.',
    }),
  )
}

{
  const text = 'A😀'
  const fallback = {
    fontKey: 'synthetic/symbols',
    ascender: 10,
    descender: -3,
    lineGap: 1,
    decorationMetrics: {
      underlinePosition: -1.25,
      underlineThickness: 0.6,
      strikethroughPosition: 3.5,
      strikethroughThickness: 0.6,
    },
  }
  const a = glyph(65, 0, 1)
  const emoji = glyph(128512, 1, 3, 12, { left: 0, bottom: -3, right: 12, top: 10 })
  fixtures.push(
    fixture({
      id: 'runs-fallback-grapheme',
      intent: 'Resolve a supplementary grapheme as one fallback run without splitting its surrogate pair.',
      tags: ['runs', 'fallback', 'grapheme', 'supplementary-plane'],
      text,
      runs: [run(text, [a], { start: 0, end: 1 }), run(text, [emoji], { start: 1, end: 3, fontKey: fallback.fontKey, script: 'Zyyy', metrics: fallback })],
      glyphs: [placed(a, 0, 0, 0), placed(emoji, 10, 0, 0, { fontKey: fallback.fontKey })],
      lines: [line(0, 3, 0, 2, 0, 0, 22, 'none', 12)],
      carets: [caret(0, 0, 0, 0, 12), caret(1, 0, 10, 0, 12), caret(3, 0, 22, 0, 12)],
      blockBounds: bounds(0, -3, 22, 10),
      visibleBounds: bounds(0, -3, 22, 10),
      classification: 'intentional-change',
      rationale: 'Fallback must resolve the complete supplementary grapheme instead of independent code units.',
    }),
  )
}

{
  const text = 'A '
  const a = glyph(65, 0, 1, 10, { left: -2, bottom: -3, right: 12, top: 9 })
  const space = glyph(32, 1, 2, 5, null)
  fixtures.push(
    fixture({
      id: 'bounds-overhang-empty-grouping',
      intent: 'Separate block and visible bounds and keep them independent of renderer grouping.',
      tags: ['bounds', 'overhang', 'empty-glyph', 'grouping'],
      text,
      runs: [run(text, [a, space])],
      glyphs: [placed(a, 0, 0, 0)],
      lines: [line(0, 2, 0, 1, 0, 0, 10)],
      carets: [caret(0, 0, 0), caret(1, 0, 10), caret(2, 0, 15)],
      blockBounds: bounds(0, -2, 10, 8),
      visibleBounds: bounds(-2, -3, 12, 9),
      classification: 'intentional-change',
      rationale: 'Retain block and visible bounds while removing renderer chunk grouping from the layout contract.',
    }),
  )
}

{
  const text = 'ffi é 😀'
  const ffi = glyph(501, 0, 3, 18)
  const space1 = glyph(32, 3, 4, 5, null)
  const e = glyph(101, 4, 6, 10)
  const mark = glyph(769, 4, 6, 0, { left: 3, bottom: 6, right: 7, top: 11 })
  const space2 = glyph(32, 6, 7, 5, null)
  const emoji = glyph(128512, 7, 9, 12)
  fixtures.push(
    fixture({
      id: 'carets-complex-clusters',
      intent: 'Expose editable ligature interiors while suppressing combining and surrogate-splitting stops.',
      tags: ['carets', 'ligature', 'combining', 'supplementary-plane'],
      text,
      runs: [run(text, [ffi, space1, e, mark, space2, emoji], { metrics: { ascender: 11, descender: -2, lineGap: 0 } })],
      glyphs: [placed(ffi, 0, 0, 0), placed(e, 23, 0, 0), placed(mark, 23, 0, 0), placed(emoji, 38, 0, 0)],
      lines: [line(0, 9, 0, 4, 0, 0, 50, 'none', 13)],
      carets: [caret(0, 0, 0, 0, 13), caret(1, 0, 6, 0, 13), caret(2, 0, 12, 0, 13), caret(3, 0, 18, 0, 13), caret(4, 0, 23, 0, 13), caret(6, 0, 33, 0, 13), caret(7, 0, 38, 0, 13), caret(9, 0, 50, 0, 13)],
      blockBounds: bounds(0, -2, 50, 11),
      visibleBounds: bounds(0, -2, 46, 11),
      classification: 'intentional-change',
      rationale: 'Keep editable ligature stops but suppress boundaries inside combining graphemes and surrogate pairs.',
    }),
  )
}

{
  const text = 'AB'
  const a = glyph(65, 0, 1)
  const b = glyph(66, 1, 2)
  const whole = [{ lineIndex: 0, left: 0, bottom: -2, right: 20, top: 8 }]
  fixtures.push(
    fixture({
      id: 'selection-forward-reversed-empty',
      intent: 'Normalize reversed ranges and return no rectangles for an empty selection.',
      tags: ['selection', 'forward', 'reversed', 'empty', 'clipped'],
      text,
      runs: [run(text, [a, b])],
      glyphs: [placed(a, 0, 0, 0), placed(b, 10, 0, 0)],
      lines: [line(0, 2, 0, 2, 0, 0, 20)],
      carets: [caret(0, 0, 0), caret(1, 0, 10), caret(2, 0, 20)],
      blockBounds: bounds(0, -2, 20, 8),
      visibleBounds: bounds(0, -2, 18, 8),
      selections: [
        { query: { start: 0, end: 2 }, rects: whole },
        { query: { start: 2, end: 0 }, rects: whole },
        { query: { start: 1, end: 1 }, rects: [] },
        { query: { start: -5, end: 8 }, rects: whole },
      ],
    }),
  )
}

{
  const text = 'AB\nאב'
  const values = [glyph(65, 0, 1), glyph(66, 1, 2), glyph(1488, 3, 4), glyph(1489, 4, 5)]
  fixtures.push(
    fixture({
      id: 'selection-multiline-bidi',
      intent: 'Produce deterministic per-line rectangles for a selection crossing an RTL line.',
      tags: ['selection', 'multiline', 'bidi', 'rtl'],
      text,
      runs: [run(text, values.slice(0, 2), { start: 0, end: 2 }), run(text, values.slice(2), { start: 3, end: 5, direction: 'rtl', script: 'Hebr', language: 'he' })],
      glyphs: [placed(values[0], 0, 0, 0), placed(values[1], 10, 0, 0), placed(values[2], 10, -12, 1), placed(values[3], 0, -12, 1)],
      lines: [line(0, 3, 0, 2, 0, 0, 20, 'hard'), line(3, 5, 2, 4, -12, 0, 20)],
      carets: [caret(0, 0, 0), caret(1, 0, 10), caret(2, 0, 20), caret(3, 1, 20, -12), caret(4, 1, 10, -12), caret(5, 1, 0, -12)],
      blockBounds: bounds(0, -14, 20, 8),
      visibleBounds: bounds(0, -14, 18, 8),
      selections: [{
        query: { start: 0, end: 5 },
        rects: [
          { lineIndex: 0, left: 0, bottom: -2, right: 20, top: 8 },
          { lineIndex: 1, left: 0, bottom: -14, right: 20, top: -4 },
        ],
      }],
    }),
  )
}

writeFileSync(
  output,
  `${JSON.stringify({ schemaVersion: 1, numericPrecision: 6, fixtures }, null, 2)}\n`,
)

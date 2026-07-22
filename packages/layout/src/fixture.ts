import { getSelectionRects } from './selection.js'
import type { LayoutBounds, LayoutFixtureDocument, LayoutPolicyFixture } from './types.js'

const FORBIDDEN_KEYS = /^(?:atlas|canvas|chunk|gpu|outline|path|sdf|texture|three|worker)/i

function fail(caseId: string, message: string): never {
  throw new TypeError(`Fixture ${caseId}: ${message}`)
}

function record(value: unknown, caseId: string, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(caseId, `${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function array(value: unknown, caseId: string, label: string): unknown[] {
  if (!Array.isArray(value)) fail(caseId, `${label} must be an array`)
  return value
}

function finite(value: unknown, caseId: string, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(caseId, `${label} must be finite`)
  }
  return value
}

function integer(value: unknown, caseId: string, label: string): number {
  const number = finite(value, caseId, label)
  if (!Number.isInteger(number)) fail(caseId, `${label} must be an integer`)
  return number
}

function nonEmpty(value: unknown, caseId: string, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    fail(caseId, `${label} must be a non-empty string`)
  }
  return value
}

function isUtf16Boundary(text: string, offset: number): boolean {
  if (!Number.isInteger(offset) || offset < 0 || offset > text.length) return false
  if (offset === 0 || offset === text.length) return true
  const previous = text.charCodeAt(offset - 1)
  const current = text.charCodeAt(offset)
  return !(previous >= 0xd800 && previous <= 0xdbff && current >= 0xdc00 && current <= 0xdfff)
}

function range(value: unknown, text: string, caseId: string, label: string): void {
  const item = record(value, caseId, label)
  const start = integer(item.start, caseId, `${label}.start`)
  const end = integer(item.end, caseId, `${label}.end`)
  if (start > end || !isUtf16Boundary(text, start) || !isUtf16Boundary(text, end)) {
    fail(caseId, `${label} must be a valid half-open UTF-16 range`)
  }
}

function bounds(value: unknown, caseId: string, label: string): void {
  const item = record(value, caseId, label)
  const left = finite(item.left, caseId, `${label}.left`)
  const bottom = finite(item.bottom, caseId, `${label}.bottom`)
  const right = finite(item.right, caseId, `${label}.right`)
  const top = finite(item.top, caseId, `${label}.top`)
  if (left > right || bottom > top) fail(caseId, `${label} is inverted`)
}

function decorationMetrics(value: unknown, caseId: string, label: string): void {
  const item = record(value, caseId, label)
  for (const key of ['underlinePosition', 'strikethroughPosition'] as const) {
    finite(item[key], caseId, `${label}.${key}`)
  }
  for (const key of ['underlineThickness', 'strikethroughThickness'] as const) {
    if (finite(item[key], caseId, `${label}.${key}`) <= 0) {
      fail(caseId, `${label}.${key} must be positive`)
    }
  }
}

function rejectHigherLayers(value: unknown, caseId: string): void {
  if (Array.isArray(value)) {
    for (const item of value) rejectHigherLayers(item, caseId)
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.test(key)) fail(caseId, `forbidden higher-layer field: ${key}`)
      rejectHigherLayers(item, caseId)
    }
  }
}

function validateResult(value: unknown, text: string, fontKeys: Set<string>, caseId: string): void {
  const result = record(value, caseId, 'expected')
  if (integer(result.sourceLengthUtf16, caseId, 'expected.sourceLengthUtf16') !== text.length) {
    fail(caseId, 'expected source length does not match input text')
  }
  const resultFontKeys = array(result.fontKeys, caseId, 'expected.fontKeys')
  for (const fontKey of resultFontKeys) {
    if (typeof fontKey !== 'string' || !fontKeys.has(fontKey)) {
      fail(caseId, 'expected.fontKeys contains an unknown font')
    }
  }

  const lines = array(result.lines, caseId, 'expected.lines')
  for (const [index, value] of lines.entries()) {
    const line = record(value, caseId, `expected.lines[${index}]`)
    range(line, text, caseId, `expected.lines[${index}]`)
    for (const key of ['glyphStart', 'glyphEnd'] as const) {
      integer(line[key], caseId, `expected.lines[${index}].${key}`)
    }
    for (const key of ['baseline', 'left', 'right', 'bottom', 'top'] as const) {
      finite(line[key], caseId, `expected.lines[${index}].${key}`)
    }
    if (!['none', 'hard', 'soft'].includes(String(line.breakAfter))) {
      fail(caseId, `expected.lines[${index}].breakAfter is invalid`)
    }
  }

  const glyphs = array(result.glyphs, caseId, 'expected.glyphs')
  for (const [index, value] of glyphs.entries()) {
    const glyph = record(value, caseId, `expected.glyphs[${index}]`)
    range(glyph, text, caseId, `expected.glyphs[${index}]`)
    if (!fontKeys.has(String(glyph.fontKey))) fail(caseId, `glyph ${index} uses an unknown font`)
    const lineIndex = integer(glyph.lineIndex, caseId, `expected.glyphs[${index}].lineIndex`)
    if (lineIndex < 0 || lineIndex >= lines.length) fail(caseId, `glyph ${index} has no line`)
    const fontUnitScale = finite(
      glyph.fontUnitScale,
      caseId,
      `expected.glyphs[${index}].fontUnitScale`,
    )
    if (fontUnitScale <= 0) fail(caseId, `glyph ${index} has an invalid fontUnitScale`)
    for (const key of [
      'glyphId',
      'x',
      'y',
      'xAdvance',
      'yAdvance',
      'xOffset',
      'yOffset',
    ] as const) {
      finite(glyph[key], caseId, `expected.glyphs[${index}].${key}`)
    }
    if (glyph.bounds !== null) bounds(glyph.bounds, caseId, `expected.glyphs[${index}].bounds`)
  }

  const carets = array(result.carets, caseId, 'expected.carets')
  let previousOffset = -1
  for (const [index, value] of carets.entries()) {
    const caret = record(value, caseId, `expected.carets[${index}]`)
    const offset = integer(caret.offset, caseId, `expected.carets[${index}].offset`)
    if (!isUtf16Boundary(text, offset) || offset <= previousOffset) {
      fail(caseId, 'caret offsets must be unique ascending UTF-16 boundaries')
    }
    previousOffset = offset
    const lineIndex = integer(caret.lineIndex, caseId, `expected.carets[${index}].lineIndex`)
    if (lineIndex < 0 || lineIndex >= lines.length) fail(caseId, `caret ${index} has no line`)
    for (const key of ['x', 'bottom', 'top'] as const) {
      finite(caret[key], caseId, `expected.carets[${index}].${key}`)
    }
  }

  decorationMetrics(result.defaultDecorationMetrics, caseId, 'expected.defaultDecorationMetrics')
  let previousMetricEnd = 0
  for (const [index, value] of array(
    result.decorationMetrics,
    caseId,
    'expected.decorationMetrics',
  ).entries()) {
    const item = record(value, caseId, `expected.decorationMetrics[${index}]`)
    range(item, text, caseId, `expected.decorationMetrics[${index}]`)
    const start = integer(item.start, caseId, `expected.decorationMetrics[${index}].start`)
    const end = integer(item.end, caseId, `expected.decorationMetrics[${index}].end`)
    if (start < previousMetricEnd) fail(caseId, 'decoration metric ranges must not overlap')
    previousMetricEnd = end
    decorationMetrics(item, caseId, `expected.decorationMetrics[${index}]`)
  }

  bounds(result.blockBounds, caseId, 'expected.blockBounds')
  if (result.visibleBounds !== null) bounds(result.visibleBounds, caseId, 'expected.visibleBounds')
}

function validateFixture(value: unknown, ids: Set<string>): void {
  const fixture = record(value, '<unknown>', 'fixture')
  const id = nonEmpty(fixture.id, '<unknown>', 'id')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) fail(id, 'id must be kebab-case')
  if (ids.has(id)) fail(id, 'duplicate id')
  ids.add(id)
  nonEmpty(fixture.intent, id, 'intent')
  nonEmpty(fixture.rationale, id, 'rationale')
  const tags = array(fixture.tags, id, 'tags')
  if (tags.length === 0 || tags.some((tag) => typeof tag !== 'string' || tag.length === 0)) {
    fail(id, 'tags must contain non-empty strings')
  }
  if (!['preserve', 'intentional-change', 'defer'].includes(String(fixture.classification))) {
    fail(id, 'classification is invalid')
  }
  const evidence = record(fixture.evidence, id, 'evidence')
  if (!['synthetic', 'troika-reference', 'font-integration'].includes(String(evidence.layer))) {
    fail(id, 'evidence.layer is invalid')
  }
  nonEmpty(evidence.source, id, 'evidence.source')
  nonEmpty(evidence.integrity, id, 'evidence.integrity')

  const input = record(fixture.input, id, 'input')
  if (typeof input.text !== 'string') fail(id, 'input.text must be a string')
  const text = input.text
  const paragraphLevel = integer(input.paragraphLevel, id, 'input.paragraphLevel')
  if (paragraphLevel !== 0 && paragraphLevel !== 1) fail(id, 'input.paragraphLevel must be 0 or 1')
  const defaultMetrics = record(input.defaultMetrics, id, 'input.defaultMetrics')
  for (const key of ['ascender', 'descender', 'lineGap'] as const) {
    finite(defaultMetrics[key], id, `input.defaultMetrics.${key}`)
  }
  decorationMetrics(defaultMetrics.decorationMetrics, id, 'input.defaultMetrics.decorationMetrics')
  if (input.maxWidth !== null) finite(input.maxWidth, id, 'input.maxWidth')
  for (const key of ['textIndent', 'letterSpacing'] as const) {
    finite(input[key], id, `input.${key}`)
  }
  if (input.lineHeight !== 'normal') finite(input.lineHeight, id, 'input.lineHeight')
  for (const [key, values] of [
    ['whiteSpace', ['normal', 'nowrap']],
    ['overflowWrap', ['normal', 'break-word']],
    ['textAlign', ['left', 'center', 'right', 'justify']],
  ] as const) {
    if (!values.includes(String(input[key]) as never)) fail(id, `input.${key} is invalid`)
  }

  const fontKeys = new Set<string>()
  let previousRunEnd = 0
  for (const [runIndex, value] of array(input.runs, id, 'input.runs').entries()) {
    const run = record(value, id, `input.runs[${runIndex}]`)
    range(run, text, id, `input.runs[${runIndex}]`)
    const runStart = integer(run.start, id, `input.runs[${runIndex}].start`)
    const runEnd = integer(run.end, id, `input.runs[${runIndex}].end`)
    if (runStart < previousRunEnd) fail(id, `run ${runIndex} overlaps the previous run`)
    previousRunEnd = runEnd
    const fontKey = nonEmpty(run.fontKey, id, `input.runs[${runIndex}].fontKey`)
    fontKeys.add(fontKey)
    nonEmpty(run.styleKey, id, `input.runs[${runIndex}].styleKey`)
    nonEmpty(run.script, id, `input.runs[${runIndex}].script`)
    nonEmpty(run.language, id, `input.runs[${runIndex}].language`)
    if (run.direction !== 'ltr' && run.direction !== 'rtl')
      fail(id, `input.runs[${runIndex}].direction is invalid`)
    const bidiLevel = integer(run.bidiLevel, id, `input.runs[${runIndex}].bidiLevel`)
    if (bidiLevel < 0 || bidiLevel % 2 !== (run.direction === 'rtl' ? 1 : 0)) {
      fail(id, `input.runs[${runIndex}].bidiLevel parity does not match direction`)
    }
    finite(run.fontSize, id, `input.runs[${runIndex}].fontSize`)
    const fontUnitScale = finite(run.fontUnitScale, id, `input.runs[${runIndex}].fontUnitScale`)
    if (fontUnitScale <= 0) fail(id, `input.runs[${runIndex}].fontUnitScale must be positive`)
    const metrics = record(run.metrics, id, `input.runs[${runIndex}].metrics`)
    for (const key of ['ascender', 'descender', 'lineGap'] as const) {
      finite(metrics[key], id, `input.runs[${runIndex}].metrics.${key}`)
    }
    decorationMetrics(
      metrics.decorationMetrics,
      id,
      `input.runs[${runIndex}].metrics.decorationMetrics`,
    )
    for (const [glyphIndex, glyphValue] of array(
      run.glyphs,
      id,
      `input.runs[${runIndex}].glyphs`,
    ).entries()) {
      const glyph = record(glyphValue, id, `run ${runIndex} glyph ${glyphIndex}`)
      range(glyph, text, id, `run ${runIndex} glyph ${glyphIndex}`)
      if (Number(glyph.start) < runStart || Number(glyph.end) > runEnd) {
        fail(id, `run ${runIndex} glyph ${glyphIndex} is outside its run`)
      }
      for (const key of [
        'glyphId',
        'xAdvance',
        'yAdvance',
        'xOffset',
        'yOffset',
        'flags',
      ] as const) {
        finite(glyph[key], id, `run ${runIndex} glyph ${glyphIndex}.${key}`)
      }
      if (glyph.bounds !== null)
        bounds(glyph.bounds, id, `run ${runIndex} glyph ${glyphIndex}.bounds`)
    }
  }

  validateResult(fixture.expected, text, fontKeys, id)
  for (const [index, value] of array(fixture.selections, id, 'selections').entries()) {
    const selection = record(value, id, `selections[${index}]`)
    const query = record(selection.query, id, `selections[${index}].query`)
    integer(query.start, id, `selections[${index}].query.start`)
    integer(query.end, id, `selections[${index}].query.end`)
    for (const [rectIndex, rect] of array(
      selection.rects,
      id,
      `selections[${index}].rects`,
    ).entries()) {
      bounds(rect, id, `selections[${index}].rects[${rectIndex}]`)
      const item = record(rect, id, `selections[${index}].rects[${rectIndex}]`)
      integer(item.lineIndex, id, `selections[${index}].rects[${rectIndex}].lineIndex`)
    }
  }
  rejectHigherLayers(fixture, id)
}

export function validateLayoutFixtureDocument(
  value: unknown,
): asserts value is LayoutFixtureDocument {
  const document = record(value, '<document>', 'document')
  if (document.schemaVersion !== 1) fail('<document>', 'schemaVersion must be 1')
  const precision = integer(document.numericPrecision, '<document>', 'numericPrecision')
  if (precision < 0 || precision > 12)
    fail('<document>', 'numericPrecision must be between 0 and 12')
  const ids = new Set<string>()
  for (const fixture of array(document.fixtures, '<document>', 'fixtures'))
    validateFixture(fixture, ids)
  if (ids.size === 0) fail('<document>', 'fixtures must not be empty')
}

function canonical(value: unknown, precision: number): unknown {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Cannot serialize a non-finite number')
    const rounded = Number(value.toFixed(precision))
    return Object.is(rounded, -0) ? 0 : rounded
  }
  if (Array.isArray(value)) return value.map((item) => canonical(item, precision))
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item, precision)]),
    )
  }
  return value
}

export function canonicalFixtureJson(value: unknown, precision = 6): string {
  if (!Number.isInteger(precision) || precision < 0 || precision > 12) {
    throw new RangeError('precision must be an integer between 0 and 12')
  }
  return `${JSON.stringify(canonical(value, precision), null, 2)}\n`
}

/** Compatibility name for validation consumers. */
export function deriveSelectionRects(
  result: Parameters<typeof getSelectionRects>[0],
  start: number,
  end: number,
): ReturnType<typeof getSelectionRects> {
  return getSelectionRects(result, { start, end })
}

export type { LayoutBounds, LayoutPolicyFixture }

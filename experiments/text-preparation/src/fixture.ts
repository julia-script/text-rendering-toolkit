import type {
  PreparationExpectation,
  PreparationFixtureDocument,
  PreparedSegment,
} from './types.js'

const FORBIDDEN_KEYS =
  /^(?:atlas|bytes|canvas|fontHandle|gpu|outline|promise|sdf|texture|three|url|worker)$/i
const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' })

function fail(id: string, message: string): never {
  throw new TypeError(`Preparation fixture ${id}: ${message}`)
}

function record(value: unknown, id: string, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(id, `${label} must be an object`)
  return value as Record<string, unknown>
}

function array(value: unknown, id: string, label: string): unknown[] {
  if (!Array.isArray(value)) fail(id, `${label} must be an array`)
  return value
}

function text(value: unknown, id: string, label: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) {
    fail(id, `${label} must be ${allowEmpty ? 'a string' : 'non-empty'}`)
  }
  return value
}

function integer(value: unknown, id: string, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) fail(id, `${label} must be an integer`)
  return value
}

function finite(value: unknown, id: string, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Object.is(value, -0)) {
    fail(id, `${label} must be finite and not negative zero`)
  }
  return value
}

function graphemeBoundaries(value: string): ReadonlySet<number> {
  const result = new Set<number>([0, value.length])
  for (const part of segmenter.segment(value)) {
    result.add(part.index)
    result.add(part.index + part.segment.length)
  }
  return result
}

function range(
  value: Record<string, unknown>,
  source: string,
  boundaries: ReadonlySet<number>,
  id: string,
  label: string,
): void {
  const start = integer(value.start, id, `${label}.start`)
  const end = integer(value.end, id, `${label}.end`)
  if (
    start < 0 ||
    start >= end ||
    end > source.length ||
    !boundaries.has(start) ||
    !boundaries.has(end)
  ) {
    fail(id, `${label} must be a non-empty grapheme-aligned UTF-16 range`)
  }
}

function rejectUnsafe(value: unknown, id: string, path = 'fixture'): void {
  if (typeof value === 'number') {
    finite(value, id, path)
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => {
      rejectUnsafe(item, id, `${path}[${index}]`)
    })
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.test(key)) fail(id, `forbidden higher-layer field ${path}.${key}`)
      rejectUnsafe(item, id, `${path}.${key}`)
    }
  }
}

function validateStyle(value: unknown, id: string, label: string): void {
  const style = record(value, id, label)
  text(style.key, id, `${label}.key`)
  const fontKeys = array(style.fontKeys, id, `${label}.fontKeys`).map((key, index) =>
    text(key, id, `${label}.fontKeys[${index}]`),
  )
  if (fontKeys.length === 0 || new Set(fontKeys).size !== fontKeys.length) {
    fail(id, `${label}.fontKeys must be non-empty and unique`)
  }
  if (finite(style.fontSize, id, `${label}.fontSize`) <= 0)
    fail(id, `${label}.fontSize must be positive`)
  text(style.language, id, `${label}.language`)
  if (style.features !== undefined) array(style.features, id, `${label}.features`)
  if (style.variations !== undefined) record(style.variations, id, `${label}.variations`)
}

function validateSegment(
  value: unknown,
  source: string,
  boundaries: ReadonlySet<number>,
  id: string,
  label: string,
): void {
  const segment = record(value, id, label)
  range(segment, source, boundaries, id, label)
  const paragraphLevel = integer(segment.paragraphLevel, id, `${label}.paragraphLevel`)
  if (paragraphLevel !== 0 && paragraphLevel !== 1) fail(id, `${label}.paragraphLevel is invalid`)
  const bidiLevel = integer(segment.bidiLevel, id, `${label}.bidiLevel`)
  if (bidiLevel < 0 || bidiLevel % 2 !== (segment.direction === 'rtl' ? 1 : 0)) {
    fail(id, `${label}.bidiLevel parity is invalid`)
  }
  if (segment.direction !== 'ltr' && segment.direction !== 'rtl')
    fail(id, `${label}.direction is invalid`)
  if (!/^[A-Z][a-z]{3}$/.test(text(segment.script, id, `${label}.script`))) {
    fail(id, `${label}.script must be ISO 15924`)
  }
  text(segment.styleKey, id, `${label}.styleKey`)
  text(segment.language, id, `${label}.language`)
  if (finite(segment.fontSize, id, `${label}.fontSize`) <= 0)
    fail(id, `${label}.fontSize must be positive`)
  if (array(segment.fontKeys, id, `${label}.fontKeys`).length === 0)
    fail(id, `${label}.fontKeys is empty`)
  array(segment.features, id, `${label}.features`)
  record(segment.variations, id, `${label}.variations`)
}

function validateExpected(
  value: unknown,
  source: string,
  boundaries: ReadonlySet<number>,
  id: string,
): void {
  const expected = record(value, id, 'expected')
  if (!expected.preparedSegments && !expected.resolved && !expected.layout && !expected.error) {
    fail(id, 'expected must describe a result or error')
  }
  if (expected.preparedSegments) {
    array(expected.preparedSegments, id, 'expected.preparedSegments').forEach((segment, index) => {
      validateSegment(segment, source, boundaries, id, `expected.preparedSegments[${index}]`)
    })
  }
  if (expected.resolved) {
    const resolved = record(expected.resolved, id, 'expected.resolved')
    array(resolved.fontKeys, id, 'expected.resolved.fontKeys')
    array(resolved.runRanges, id, 'expected.resolved.runRanges').forEach((item, index) => {
      const run = record(item, id, `expected.resolved.runRanges[${index}]`)
      range(run, source, boundaries, id, `expected.resolved.runRanges[${index}]`)
      text(run.fontKey, id, `expected.resolved.runRanges[${index}].fontKey`)
      text(run.styleKey, id, `expected.resolved.runRanges[${index}].styleKey`)
    })
  }
  if (expected.layout) {
    const layout = record(expected.layout, id, 'expected.layout')
    if (
      integer(layout.sourceLengthUtf16, id, 'expected.layout.sourceLengthUtf16') !== source.length
    ) {
      fail(id, 'expected.layout source length differs from input')
    }
    integer(layout.lineCount, id, 'expected.layout.lineCount')
    integer(layout.minimumGlyphCount, id, 'expected.layout.minimumGlyphCount')
    array(layout.fontKeys, id, 'expected.layout.fontKeys')
  }
  if (expected.error) {
    const error = record(expected.error, id, 'expected.error')
    if (!['invalid-input', 'missing-font', 'missing-coverage'].includes(String(error.code))) {
      fail(id, 'expected.error.code is invalid')
    }
    if (error.start !== undefined || error.end !== undefined) {
      const start = integer(error.start, id, 'expected.error.start')
      const end = integer(error.end, id, 'expected.error.end')
      if (start < 0 || start > end || end > source.length)
        fail(id, 'expected.error range is invalid')
    }
    if (error.attemptedFontKeys !== undefined) {
      array(error.attemptedFontKeys, id, 'expected.error.attemptedFontKeys')
    }
  }
}

export function validatePreparationFixtureDocument(
  value: unknown,
): asserts value is PreparationFixtureDocument {
  const document = record(value, '<document>', 'document')
  if (document.schemaVersion !== 1) fail('<document>', 'schemaVersion must be 1')
  text(document.unicodeVersion, '<document>', 'unicodeVersion')
  text(document.bidiRevision, '<document>', 'bidiRevision')
  const manifest = record(document.fontManifest, '<document>', 'fontManifest')
  text(manifest.file, '<document>', 'fontManifest.file')
  if (!/^[a-f0-9]{64}$/.test(text(manifest.sha256, '<document>', 'fontManifest.sha256'))) {
    fail('<document>', 'fontManifest.sha256 is invalid')
  }
  const ids = new Set<string>()
  for (const item of array(document.fixtures, '<document>', 'fixtures')) {
    const fixture = record(item, '<fixture>', 'fixture')
    const id = text(fixture.id, '<fixture>', 'id')
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || ids.has(id))
      fail(id, 'id is invalid or duplicated')
    ids.add(id)
    text(fixture.intent, id, 'intent')
    if (array(fixture.tags, id, 'tags').length === 0) fail(id, 'tags must not be empty')
    if (!['preserve', 'intentional-change', 'defer'].includes(String(fixture.classification))) {
      fail(id, 'classification is invalid')
    }
    text(fixture.rationale, id, 'rationale')
    const evidence = record(fixture.evidence, id, 'evidence')
    if (!['synthetic', 'font-integration', 'troika-reference'].includes(String(evidence.layer))) {
      fail(id, 'evidence.layer is invalid')
    }
    text(evidence.source, id, 'evidence.source')
    text(evidence.integrity, id, 'evidence.integrity')
    const input = record(fixture.input, id, 'input')
    const source = text(input.text, id, 'input.text', true)
    const boundaries = graphemeBoundaries(source)
    validateStyle(input.style, id, 'input.style')
    if (input.styleRanges !== undefined) {
      array(input.styleRanges, id, 'input.styleRanges').forEach((rangeValue, index) => {
        const styleRange = record(rangeValue, id, `input.styleRanges[${index}]`)
        const start = integer(styleRange.start, id, `input.styleRanges[${index}].start`)
        const end = integer(styleRange.end, id, `input.styleRanges[${index}].end`)
        if (start < 0 || start > end || end > source.length)
          fail(id, `input.styleRanges[${index}] is invalid`)
        validateStyle(styleRange.style, id, `input.styleRanges[${index}].style`)
      })
    }
    validateExpected(fixture.expected, source, boundaries, id)
    rejectUnsafe(fixture, id)
  }
}

export function canonicalPreparationFixtureJson(value: unknown): string {
  validatePreparationFixtureDocument(value)
  return `${JSON.stringify(value, null, 2)}\n`
}

export function expectationFor(
  preparedSegments: readonly PreparedSegment[],
  resolved: PreparationExpectation['resolved'],
  layout: PreparationExpectation['layout'],
): PreparationExpectation {
  return {
    preparedSegments,
    ...(resolved === undefined ? {} : { resolved }),
    ...(layout === undefined ? {} : { layout }),
  }
}

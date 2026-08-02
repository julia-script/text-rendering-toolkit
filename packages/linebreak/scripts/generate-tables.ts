/**
 * Generates committed property tables from the vendored Unicode 17.0.0 UCD files.
 *
 * Run with:
 *   pnpm --filter @text-rendering-toolkit/linebreak tables:generate
 *
 * The output is deterministic: the same vendored inputs always produce
 * byte-identical `src/tables.ts`. Regenerating after a Unicode version bump is a
 * data-directory change plus a conformance run.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const unicodeVersion = '17.0.0'
const ucd = join(packageRoot, 'data', unicodeVersion, 'ucd')

/**
 * The Line_Break property values used by UAX #14, in the order the generated
 * enumeration assigns them. Unicode 17.0.0 defines 49 values; `HH` is the value
 * added since Unicode 16.0.0.
 */
const LINE_BREAK_CLASSES = [
  'AI',
  'AK',
  'AL',
  'AP',
  'AS',
  'B2',
  'BA',
  'BB',
  'BK',
  'CB',
  'CJ',
  'CL',
  'CM',
  'CP',
  'CR',
  'EB',
  'EM',
  'EX',
  'GL',
  'H2',
  'H3',
  'HH',
  'HL',
  'HY',
  'ID',
  'IN',
  'IS',
  'JL',
  'JT',
  'JV',
  'LF',
  'NL',
  'NS',
  'NU',
  'OP',
  'PO',
  'PR',
  'QU',
  'RI',
  'SA',
  'SG',
  'SP',
  'SY',
  'VF',
  'VI',
  'WJ',
  'XX',
  'ZW',
  'ZWJ',
] as const

/** East_Asian_Width values. Only F, W, and H affect line breaking. */
const EAST_ASIAN_WIDTHS = ['A', 'F', 'H', 'N', 'Na', 'W'] as const

/**
 * General_Category values the algorithm consults, collapsed to what the rules
 * distinguish:
 *
 * - `Mn`, `Mc` — LB1 resolves SA by mark category.
 * - `Pi`, `Pf` — LB15a and LB15b select initial and final punctuation within QU.
 * - `Cn` — LB30b's second clause matches unassigned Extended_Pictographic.
 *
 * Everything else collapses to `Other`, which no rule inspects.
 */
const GENERAL_CATEGORIES = ['Mn', 'Mc', 'Pi', 'Pf', 'Cn', 'Other'] as const

/** Emoji properties consulted by the rules, as bit flags. */
const EMOJI_PROPERTIES = ['Extended_Pictographic'] as const

interface Range {
  readonly first: number
  readonly last: number
  readonly value: string
}

/**
 * Long property-value aliases used in `@missing` lines, mapped to the short
 * aliases the data rows use.
 */
const LONG_VALUE_ALIASES: Readonly<Record<string, string>> = {
  Unknown: 'XX',
  Ideographic: 'ID',
  Prefix_Numeric: 'PR',
  Postfix_Numeric: 'PO',
  Alphabetic: 'AL',
  Complex_Context: 'SA',
  Ambiguous: 'AI',
  Surrogate: 'SG',
  Combining_Mark: 'CM',
  Nonstarter: 'NS',
}

/**
 * Parses `@missing` annotations, which assign a default value to every code
 * point in a range that no data row covers.
 *
 * These matter: `DerivedLineBreak.txt` defaults unassigned code points in the
 * ideographic and pictographic blocks to ID rather than the file-wide XX, so
 * that future characters in those blocks break like ideographs. Ignoring them
 * makes reserved code points such as U+1FFFD resolve to AL and suppresses
 * breaks the conformance corpus expects.
 */
function parseMissingRanges(path: string): Range[] {
  const text = readFileSync(path, 'utf8')
  const ranges: Range[] = []

  for (const rawLine of text.split('\n')) {
    const match = /^#\s*@missing:\s*([0-9A-Fa-f]+)\.\.([0-9A-Fa-f]+)\s*;\s*(\S+)/.exec(rawLine)
    if (match === null) continue

    const value = match[3] as string
    ranges.push({
      first: Number.parseInt(match[1] as string, 16),
      last: Number.parseInt(match[2] as string, 16),
      value: LONG_VALUE_ALIASES[value] ?? value,
    })
  }
  return ranges
}

/**
 * Parses a UCD range file into `first..last ; value` records, ignoring comments
 * and blank lines. Handles both the single-code-point and range forms.
 */
function parseRanges(path: string): Range[] {
  const text = readFileSync(path, 'utf8')
  const ranges: Range[] = []

  for (const rawLine of text.split('\n')) {
    const line = rawLine.split('#')[0]?.trim()
    if (!line) continue

    const [codePointField, valueField] = line.split(';')
    if (codePointField === undefined || valueField === undefined) continue

    const value = valueField.trim()
    const bounds = codePointField.trim().split('..')
    const first = Number.parseInt(bounds[0] as string, 16)
    const last = bounds.length > 1 ? Number.parseInt(bounds[1] as string, 16) : first

    if (!Number.isInteger(first) || !Number.isInteger(last)) {
      throw new Error(`Malformed code point field in ${path}: ${rawLine}`)
    }
    ranges.push({ first, last, value })
  }

  if (ranges.length === 0) throw new Error(`No ranges parsed from ${path}`)
  return ranges
}

/**
 * Builds a flat lookup over the full Unicode code point space, filling
 * unassigned positions with `defaultIndex`.
 */
function buildLookup(
  ranges: readonly Range[],
  indexOf: (value: string) => number | undefined,
  defaultIndex: number,
  missingRanges: readonly Range[] = [],
): Uint8Array {
  const table = new Uint8Array(0x110000).fill(defaultIndex)

  // `@missing` defaults are applied first so explicit assignments override them.
  for (const { first, last, value } of missingRanges) {
    const index = indexOf(value)
    if (index === undefined) continue
    for (let codePoint = first; codePoint <= last; codePoint += 1) {
      table[codePoint] = index
    }
  }

  for (const { first, last, value } of ranges) {
    const index = indexOf(value)
    if (index === undefined) continue
    for (let codePoint = first; codePoint <= last; codePoint += 1) {
      table[codePoint] = index
    }
  }
  return table
}

/**
 * Run-length encodes a lookup as parallel boundary/value arrays. Property data
 * is extremely runny, so this is far smaller than the flat table and still
 * supports O(log n) lookup by binary search over the boundaries.
 */
function encodeRuns(table: Uint8Array): { boundaries: number[]; values: number[] } {
  const boundaries: number[] = []
  const values: number[] = []
  let previous = -1

  for (let codePoint = 0; codePoint < table.length; codePoint += 1) {
    const value = table[codePoint] as number
    if (value !== previous) {
      boundaries.push(codePoint)
      values.push(value)
      previous = value
    }
  }
  return { boundaries, values }
}

function formatNumberArray(name: string, type: string, numbers: readonly number[]): string {
  const lines: string[] = []
  const perLine = 12

  for (let index = 0; index < numbers.length; index += perLine) {
    lines.push(`  ${numbers.slice(index, index + perLine).join(', ')},`)
  }
  return `const ${name} = new ${type}([\n${lines.join('\n')}\n])\n`
}

function requireIndex(values: readonly string[], value: string): number | undefined {
  const index = values.indexOf(value)
  return index === -1 ? undefined : index
}

const lineBreakRanges = parseRanges(join(ucd, 'extracted', 'DerivedLineBreak.txt'))
const eastAsianWidthRanges = parseRanges(join(ucd, 'extracted', 'DerivedEastAsianWidth.txt'))
const generalCategoryRanges = parseRanges(join(ucd, 'extracted', 'DerivedGeneralCategory.txt'))
const emojiRanges = parseRanges(join(ucd, 'emoji', 'emoji-data.txt'))

// Verify the vendored data contains exactly the classes we expect. A new Unicode
// version that adds a class must fail here rather than silently resolving it to XX.
const observedClasses = new Set(lineBreakRanges.map((range) => range.value))
for (const observed of observedClasses) {
  if (!LINE_BREAK_CLASSES.includes(observed as (typeof LINE_BREAK_CLASSES)[number])) {
    throw new Error(
      `Vendored data contains unknown Line_Break class "${observed}". ` +
        `Add it to LINE_BREAK_CLASSES and implement its rules before regenerating.`,
    )
  }
}

const lineBreakTable = buildLookup(
  lineBreakRanges,
  (value) => requireIndex(LINE_BREAK_CLASSES, value),
  // Unassigned code points default to XX, which LB1 resolves to AL, except
  // where an `@missing` annotation assigns a block-specific default.
  LINE_BREAK_CLASSES.indexOf('XX'),
  parseMissingRanges(join(ucd, 'extracted', 'DerivedLineBreak.txt')),
)
const eastAsianWidthTable = buildLookup(
  eastAsianWidthRanges,
  (value) => requireIndex(EAST_ASIAN_WIDTHS, value),
  EAST_ASIAN_WIDTHS.indexOf('N'),
)
const generalCategoryTable = buildLookup(
  generalCategoryRanges,
  (value) => requireIndex(GENERAL_CATEGORIES, value),
  GENERAL_CATEGORIES.indexOf('Other'),
)
const emojiTable = buildLookup(
  emojiRanges.filter((range) =>
    EMOJI_PROPERTIES.includes(range.value as (typeof EMOJI_PROPERTIES)[number]),
  ),
  () => 1,
  0,
)

const lineBreakRuns = encodeRuns(lineBreakTable)
const eastAsianWidthRuns = encodeRuns(eastAsianWidthTable)
const generalCategoryRuns = encodeRuns(generalCategoryTable)
const emojiRuns = encodeRuns(emojiTable)

const source = `// Generated by scripts/generate-tables.ts from the vendored Unicode ${unicodeVersion}
// Character Database. Do not edit by hand — run \`pnpm tables:generate\` instead.
//
// Properties are run-length encoded as parallel boundary/value arrays: index i
// covers code points [boundaries[i], boundaries[i + 1]). Lookup is a binary
// search over the boundaries.

/** The Unicode version these tables were generated from. */
export const UNICODE_VERSION = '${unicodeVersion}'

/** Line_Break property values, as defined by UAX #14 for Unicode ${unicodeVersion}. */
export enum LineBreakClass {
${LINE_BREAK_CLASSES.map((name, index) => `  ${name} = ${index},`).join('\n')}
}

/** East_Asian_Width property values. Only F, W, and H affect line breaking. */
export enum EastAsianWidth {
${EAST_ASIAN_WIDTHS.map((name, index) => `  ${name} = ${index},`).join('\n')}
}

/** General_Category values consulted by LB1 when resolving the SA class. */
export enum GeneralCategory {
${GENERAL_CATEGORIES.map((name, index) => `  ${name} = ${index},`).join('\n')}
}

${formatNumberArray('LINE_BREAK_BOUNDARIES', 'Int32Array', lineBreakRuns.boundaries)}
${formatNumberArray('LINE_BREAK_VALUES', 'Uint8Array', lineBreakRuns.values)}
${formatNumberArray('EAST_ASIAN_WIDTH_BOUNDARIES', 'Int32Array', eastAsianWidthRuns.boundaries)}
${formatNumberArray('EAST_ASIAN_WIDTH_VALUES', 'Uint8Array', eastAsianWidthRuns.values)}
${formatNumberArray('GENERAL_CATEGORY_BOUNDARIES', 'Int32Array', generalCategoryRuns.boundaries)}
${formatNumberArray('GENERAL_CATEGORY_VALUES', 'Uint8Array', generalCategoryRuns.values)}
${formatNumberArray('EXTENDED_PICTOGRAPHIC_BOUNDARIES', 'Int32Array', emojiRuns.boundaries)}
${formatNumberArray('EXTENDED_PICTOGRAPHIC_VALUES', 'Uint8Array', emojiRuns.values)}
/**
 * Finds the run covering \`codePoint\` and returns its value.
 *
 * Boundaries are ascending and start at 0, so the run is the last boundary less
 * than or equal to the code point.
 */
function lookup(boundaries: Int32Array, values: Uint8Array, codePoint: number): number {
  let low = 0
  let high = boundaries.length - 1

  while (low < high) {
    const middle = (low + high + 1) >>> 1
    if ((boundaries[middle] as number) <= codePoint) {
      low = middle
    } else {
      high = middle - 1
    }
  }
  return values[low] as number
}

/** Returns the raw Line_Break class of a code point, before LB1 resolution. */
export function getLineBreakClass(codePoint: number): LineBreakClass {
  return lookup(LINE_BREAK_BOUNDARIES, LINE_BREAK_VALUES, codePoint) as LineBreakClass
}

/** Returns the East_Asian_Width of a code point. */
export function getEastAsianWidth(codePoint: number): EastAsianWidth {
  return lookup(EAST_ASIAN_WIDTH_BOUNDARIES, EAST_ASIAN_WIDTH_VALUES, codePoint) as EastAsianWidth
}

/** Returns the General_Category of a code point, collapsed to the values LB1 needs. */
export function getGeneralCategory(codePoint: number): GeneralCategory {
  return lookup(GENERAL_CATEGORY_BOUNDARIES, GENERAL_CATEGORY_VALUES, codePoint) as GeneralCategory
}

/** Returns whether a code point has the Extended_Pictographic property. */
export function isExtendedPictographic(codePoint: number): boolean {
  return lookup(EXTENDED_PICTOGRAPHIC_BOUNDARIES, EXTENDED_PICTOGRAPHIC_VALUES, codePoint) === 1
}
`

const outputPath = join(packageRoot, 'src', 'tables.ts')
writeFileSync(outputPath, source)

// Hand the result to the repository formatter. The generated arrays are far too
// long to lay out by hand in a way that survives `biome check`, and a mismatch
// would fail CI after every regeneration.
execFileSync('pnpm', ['biome', 'format', '--write', outputPath], {
  cwd: join(packageRoot, '..', '..'),
  stdio: 'pipe',
})

process.stdout.write(
  `Generated src/tables.ts from Unicode ${unicodeVersion}\n` +
    `  line-break classes: ${LINE_BREAK_CLASSES.length} (${observedClasses.size} present in data)\n` +
    `  line-break runs: ${lineBreakRuns.boundaries.length}\n` +
    `  east-asian-width runs: ${eastAsianWidthRuns.boundaries.length}\n` +
    `  general-category runs: ${generalCategoryRuns.boundaries.length}\n` +
    `  extended-pictographic runs: ${emojiRuns.boundaries.length}\n`,
)

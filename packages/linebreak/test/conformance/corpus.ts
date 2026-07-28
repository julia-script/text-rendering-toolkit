/**
 * Parses the vendored `LineBreakTest.txt` conformance corpus.
 *
 * Each corpus line encodes one case as alternating break markers and hexadecimal
 * code points, followed by a comment naming the rule that decided each position:
 *
 * ```
 * × 2757 × 0020 ÷ 2757 ÷	#  × [0.3] HEAVY … × [7.01] SPACE (SP) ÷ [18.0] …
 * ```
 *
 * `÷` marks a break opportunity and `×` marks a prohibited position. The leading
 * marker is always `×` (LB2: never break at start of text) and the trailing marker
 * is always `÷` (LB3: always break at end of text).
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const CORPUS_PATH = join(
  packageRoot,
  'data',
  '17.0.0',
  'ucd',
  'auxiliary',
  'LineBreakTest.txt',
)

export interface ConformanceCase {
  /** 1-based line number in the corpus file, for attributing failures. */
  readonly line: number
  /** The code points under test, in order. */
  readonly codePoints: readonly number[]
  /** The text formed by those code points. */
  readonly text: string
  /**
   * Expected break opportunities as UTF-16 offsets into `text`.
   *
   * Offset 0 is excluded (LB2 never breaks at start of text) and the terminal
   * offset is included (LB3 always breaks at end of text), matching the
   * opportunity list the implementation produces.
   */
  readonly expected: readonly number[]
  /** Rule numbers cited by the corpus comment, e.g. `['0.3', '7.01', '18.0']`. */
  readonly rules: readonly string[]
  /** The raw corpus line, for failure messages. */
  readonly raw: string
}

/**
 * Reads and parses every case in the corpus.
 *
 * Throws rather than skipping on a malformed line: a silently dropped case would
 * inflate the pass rate, and the spec requires that no case be excluded without a
 * recorded reason.
 */
export function loadConformanceCases(): ConformanceCase[] {
  // The corpus is fetched rather than committed, so an absent file must fail
  // loudly. Silently reporting zero cases would turn the conformance suite into
  // a test that always passes.
  let text: string
  try {
    text = readFileSync(CORPUS_PATH, 'utf8')
  } catch {
    throw new Error(
      `Conformance corpus missing at ${CORPUS_PATH}.\n` +
        `Run: pnpm --filter @text-rendering-toolkit/linebreak corpus:fetch`,
    )
  }
  const cases: ConformanceCase[] = []

  const lines = text.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] as string
    const [body, comment] = splitComment(raw)
    if (body.length === 0) continue

    cases.push(parseCase(body, comment, index + 1, raw))
  }

  if (cases.length === 0) {
    throw new Error(`No conformance cases parsed from ${CORPUS_PATH}`)
  }
  return cases
}

function splitComment(raw: string): [string, string] {
  const hash = raw.indexOf('#')
  if (hash === -1) return [raw.trim(), '']
  return [raw.slice(0, hash).trim(), raw.slice(hash + 1)]
}

function parseCase(
  body: string,
  comment: string,
  line: number,
  raw: string,
): ConformanceCase {
  const tokens = body.split(/\s+/).filter((token) => token.length > 0)

  const codePoints: number[] = []
  const expected: number[] = []
  let offset = 0
  let sawMarker = false

  for (const token of tokens) {
    if (token === '÷' || token === '×') {
      if (token === '÷' && sawMarker) expected.push(offset)
      sawMarker = true
      continue
    }

    const codePoint = Number.parseInt(token, 16)
    if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
      throw new Error(`Malformed code point "${token}" on corpus line ${line}: ${raw}`)
    }
    codePoints.push(codePoint)
    offset += codePoint > 0xffff ? 2 : 1
  }

  if (codePoints.length === 0) {
    throw new Error(`Corpus line ${line} contains no code points: ${raw}`)
  }

  // The first marker is the start-of-text position, which is never an
  // opportunity. Drop it if the corpus recorded one there.
  const opportunities = expected.filter((position) => position > 0)

  return {
    line,
    codePoints,
    text: String.fromCodePoint(...codePoints),
    expected: opportunities,
    rules: [...comment.matchAll(/\[([0-9]+\.[0-9]+)\]/g)].map((match) => match[1] as string),
    raw: raw.trim(),
  }
}

export { CORPUS_PATH }

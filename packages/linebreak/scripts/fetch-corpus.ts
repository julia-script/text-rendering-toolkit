/**
 * Downloads the Unicode conformance corpus used by the line-breaking tests.
 *
 * The corpus is ~3.9 MB of generated test data, so it is fetched rather than
 * vendored. The property files the generator reads are small and stay committed,
 * because a build must never depend on the network to produce shipped output.
 *
 * The download is verified against a pinned SHA-256 digest: a corpus that
 * changed upstream would silently move the pass rate, which is the one number
 * this package's evidence rests on.
 *
 * Run directly, or let `pretest` invoke it:
 *
 * ```sh
 * pnpm --filter @text-rendering-toolkit/linebreak corpus:fetch
 * ```
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

export const UNICODE_VERSION = '17.0.0'
export const CORPUS_URL = `https://www.unicode.org/Public/${UNICODE_VERSION}/ucd/auxiliary/LineBreakTest.txt`
export const CORPUS_PATH = join(
  packageRoot,
  'data',
  UNICODE_VERSION,
  'ucd',
  'auxiliary',
  'LineBreakTest.txt',
)

/**
 * SHA-256 of `LineBreakTest-17.0.0.txt` as published on 2025-07-24.
 *
 * A mismatch means the upstream file changed; re-verify the pass rate before
 * updating this digest.
 */
export const CORPUS_SHA256 = 'e69884e0dde6a8724873f885d68c52dc14518abf9ae4ca9e2283b8773db3b752'

function digestOf(contents: Buffer | string): string {
  return createHash('sha256').update(contents).digest('hex')
}

/** Returns whether the corpus is present and matches the pinned digest. */
export function corpusIsValid(): boolean {
  if (!existsSync(CORPUS_PATH)) return false
  return digestOf(readFileSync(CORPUS_PATH)) === CORPUS_SHA256
}

async function main(): Promise<void> {
  if (corpusIsValid()) {
    process.stdout.write(`Corpus already present and verified (${UNICODE_VERSION})\n`)
    return
  }

  process.stdout.write(`Fetching ${CORPUS_URL}\n`)
  const response = await fetch(CORPUS_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch corpus: ${response.status} ${response.statusText}`)
  }
  const body = Buffer.from(await response.arrayBuffer())

  const actual = digestOf(body)
  if (actual !== CORPUS_SHA256) {
    throw new Error(
      `Corpus digest mismatch.\n  expected ${CORPUS_SHA256}\n  actual   ${actual}\n` +
        `The upstream file changed. Re-run the conformance suite and update ` +
        `CORPUS_SHA256 in scripts/fetch-corpus.ts only after confirming the pass rate.`,
    )
  }

  mkdirSync(dirname(CORPUS_PATH), { recursive: true })
  writeFileSync(CORPUS_PATH, body)
  process.stdout.write(`Wrote ${CORPUS_PATH} (${body.length} bytes, sha256 ok)\n`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main()
}

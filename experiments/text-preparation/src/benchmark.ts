import { readFile, writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { type FontHandle, loadFont } from '@text-rendering-toolkit/font'
import { prepareText } from './prepare.js'
import { layoutPreparedText, layoutText } from './resolve.js'
import type { PreparationFixtureDocument } from './types.js'

const root = new URL('../../../../', import.meta.url)
const fixtures = JSON.parse(
  await readFile(new URL('test-fixtures/preparation/fixtures.json', root), 'utf8'),
) as PreparationFixtureDocument
const fontRoot = new URL('test-fixtures/fonts/harfbuzz-validation/', root)
const files = {
  latin: 'NotoSans-wdth-wght.ttf',
  arabic: 'NotoSansArabic-wdth-wght.ttf',
} as const
const fonts = new Map<string, FontHandle>()

function measure(iterations: number, operation: () => void): number {
  const start = performance.now()
  for (let index = 0; index < iterations; index += 1) operation()
  return performance.now() - start
}

function rounded(value: number): number {
  return Math.round(value * 1_000) / 1_000
}

try {
  for (const [key, file] of Object.entries(files)) {
    fonts.set(key, await loadFont(new Uint8Array(await readFile(new URL(file, fontRoot)))))
  }
  const fixture = fixtures.fixtures.find((item) => item.id === 'mixed-bidi-fallback')
  if (!fixture) throw new Error('Missing mixed-bidi-fallback fixture')
  const prepared = prepareText(fixture.input)
  for (let index = 0; index < 20; index += 1) layoutText(fixture.input, fonts)
  const iterations = 200
  const prepareMilliseconds = measure(iterations, () => {
    prepareText(fixture.input)
  })
  const reusedPreparedMilliseconds = measure(iterations, () => {
    layoutPreparedText(prepared, fonts)
  })
  const oneCallMilliseconds = measure(iterations, () => {
    layoutText(fixture.input, fonts)
  })
  const observation = {
    schemaVersion: 1,
    runtime: process.version,
    platform: `${process.platform}-${process.arch}`,
    fixture: fixture.id,
    iterations,
    preparedJsonBytes: Buffer.byteLength(JSON.stringify(prepared)),
    prepareMilliseconds: rounded(prepareMilliseconds),
    reusedPreparedMilliseconds: rounded(reusedPreparedMilliseconds),
    oneCallMilliseconds: rounded(oneCallMilliseconds),
    avoidedMilliseconds: rounded(oneCallMilliseconds - reusedPreparedMilliseconds),
    conclusion:
      'PreparedText is real reusable analysis, but this observation establishes no end-to-end speed advantage because shaping dominates.',
  }
  const artifact = new URL('experiments/text-preparation/artifacts/cost.json', root)
  await writeFile(artifact, `${JSON.stringify(observation, null, 2)}\n`)
} finally {
  for (const font of fonts.values()) font.dispose()
}

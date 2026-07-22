import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  acceptedSequences,
  formatConfiguration,
  NAN0EMOJI_VERSION,
  SOURCE_LICENSE,
  sourceEvidence,
} from './fixture-manifest.js'
import { COLOR_FORMATS, type FixtureEvidence } from './schema.js'
import { tableInventory } from './sfnt.js'

const root = fileURLToPath(new URL('../../../..', import.meta.url))
const fixtureRoot = resolve(root, 'test-fixtures/fonts/color-glyph-validation')

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

async function command(program: string, args: readonly string[], environment = process.env) {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(program, args, { env: environment, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`${program} exited with ${String(code)}`))
    })
  })
}

async function acquireSource(directory: string, item: (typeof sourceEvidence)[number]) {
  const target = resolve(directory, basename(item.path))
  const response = await fetch(item.url)
  if (!response.ok) throw new Error(`Unable to acquire ${item.url}: ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const actual = sha256(bytes)
  if (actual !== item.sha256) throw new Error(`Integrity mismatch for ${item.path}: ${actual}`)
  await writeFile(target, bytes)
  return target
}

async function acquireLicense(): Promise<Uint8Array> {
  const response = await fetch(SOURCE_LICENSE.url)
  if (!response.ok) throw new Error(`Unable to acquire source license: ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const actual = sha256(bytes)
  if (actual !== SOURCE_LICENSE.sha256) {
    throw new Error(`Source license integrity mismatch: ${actual}`)
  }
  return bytes
}

async function main() {
  await mkdir(fixtureRoot, { recursive: true })
  const temporary = await mkdtemp(resolve(tmpdir(), 'color-glyph-validation-'))
  try {
    const license = await acquireLicense()
    const sources = []
    for (const item of sourceEvidence) sources.push(await acquireSource(temporary, item))
    const fixtures: FixtureEvidence[] = []
    for (const format of COLOR_FORMATS) {
      const target = resolve(fixtureRoot, `noto-validation-${format}.ttf`)
      const buildDirectory = resolve(temporary, `build-${format}`)
      await command(
        'uvx',
        [
          '--from',
          `nanoemoji==${NAN0EMOJI_VERSION}`,
          'nanoemoji',
          `--build_dir=${buildDirectory}`,
          `--color_format=${formatConfiguration[format]}`,
          '--family=ColorGlyphValidation',
          `--output_file=${target}`,
          '--keep_glyph_names',
          ...sources,
        ],
        { ...process.env, SOURCE_DATE_EPOCH: '1633539542' },
      )
      const bytes = await readFile(target)
      fixtures.push({
        format,
        path: relative(root, target),
        sha256: sha256(bytes),
        bytes: bytes.length,
        tables: tableInventory(bytes),
        sequences: acceptedSequences,
      })
    }
    await writeFile(
      resolve(fixtureRoot, 'fixtures.json'),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          generatedBy: `nanoemoji ${NAN0EMOJI_VERSION}`,
          sourceRevision: 'googlefonts/noto-emoji@b960563a023fbd1337227bf2a8a2d5a91889a333',
          sourceLicense: 'Apache-2.0',
          derivation: 'Identical pinned SVG corpus compiled once per color format',
          sources: sourceEvidence,
          fixtures,
        },
        null,
        2,
      )}\n`,
    )
    await writeFile(resolve(fixtureRoot, 'LICENSE'), license)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

await main()

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadFont } from '@webgpu-text/font'
import { describe, expect, test } from 'vitest'
import { COLOR_FORMATS, type FixtureEvidence, validateObservation } from '../src/schema.js'
import {
  colrV0Layers,
  colrVersion,
  cpalPalette,
  sbixStrikes,
  svgDocumentRanges,
  tableInventory,
} from '../src/sfnt.js'

const root = fileURLToPath(new URL('../../..', import.meta.url))
const fixtureRoot = resolve(root, 'test-fixtures/fonts/color-glyph-validation')

async function manifest() {
  return JSON.parse(await readFile(resolve(fixtureRoot, 'fixtures.json'), 'utf8')) as {
    fixtures: FixtureEvidence[]
  }
}

describe('reproducible color fixtures', () => {
  test('match their accepted hashes and exact format tables', async () => {
    const document = await manifest()
    expect(document.fixtures.map(({ format }) => format)).toEqual(COLOR_FORMATS)
    for (const fixture of document.fixtures) {
      const bytes = await readFile(resolve(root, fixture.path))
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(fixture.sha256)
      expect(tableInventory(bytes)).toEqual(fixture.tables)
    }

    const colr0 = await readFile(resolve(fixtureRoot, 'noto-validation-colr-v0.ttf'))
    const colr1 = await readFile(resolve(fixtureRoot, 'noto-validation-colr-v1.ttf'))
    const sbix = await readFile(resolve(fixtureRoot, 'noto-validation-sbix.ttf'))
    const svg = await readFile(resolve(fixtureRoot, 'noto-validation-svg.ttf'))
    expect(colrVersion(colr0)).toBe(0)
    expect(colrVersion(colr1)).toBe(1)
    expect(cpalPalette(colr0)?.length).toBeGreaterThan(1)
    expect(sbixStrikes(sbix)).toEqual([{ ppem: 109, resolution: 72 }])
    expect(svgDocumentRanges(svg)).toHaveLength(5)
  })

  test('loads and shapes every accepted sequence through the public font boundary', async () => {
    const document = await manifest()
    for (const fixture of document.fixtures) {
      const bytes = await readFile(resolve(root, fixture.path))
      const font = await loadFont(bytes)
      try {
        for (const text of fixture.sequences) {
          const shaped = font.shape({ text, direction: 'ltr', script: 'Zyyy', language: 'und' })
          expect(shaped.glyphs, `${fixture.format}: ${text}`).toHaveLength(1)
          expect(shaped.glyphs[0]?.sourceText).toBe(text)
          if (fixture.format === 'colr-v0') {
            expect(colrV0Layers(bytes, shaped.glyphs[0]?.glyphId ?? -1)?.length).toBeGreaterThan(0)
          }
        }
      } finally {
        font.dispose()
      }
    }
  })
})

describe('observation schema', () => {
  test('accepts attributable finite evidence and rejects incomplete records', () => {
    expect(
      validateObservation({
        schemaVersion: '1',
        kind: 'candidate-matrix',
        environment: { node: process.version, platform: process.platform },
        evidence: [{ source: 'fixture manifest', integrity: 'sha256:abc' }],
        measurements: { candidates: 4 },
      }),
    ).toBeTruthy()
    expect(() =>
      validateObservation({
        schemaVersion: '1',
        kind: 'candidate-matrix',
        environment: { node: process.version, platform: process.platform },
        evidence: [],
      }),
    ).toThrow('evidence')
  })
})

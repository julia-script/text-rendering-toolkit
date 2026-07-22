import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type FontHandle, loadFont } from '@webgpu-text/font'
import {
  getSelectionRects,
  type LayoutResult,
  layoutPreparedText,
  prepareText,
  type TextStyle,
} from '@webgpu-text/layout'
import { colorExportInventory, productionRuntimeInventory } from './runtime.js'
import { type CandidateScore, type FixtureEvidence, validateObservation } from './schema.js'
import {
  colrV0Layers,
  colrVersion,
  cpalPalette,
  sbixStrikes,
  svgDocumentRanges,
  tableInventory,
} from './sfnt.js'

const root = fileURLToPath(new URL('../../../..', import.meta.url))
const experiment = resolve(root, 'experiments/color-glyph-boundary')
const artifacts = resolve(experiment, 'artifacts')
const fixtureRoot = resolve(root, 'test-fixtures/fonts/color-glyph-validation')
const manifestPath = resolve(fixtureRoot, 'fixtures.json')
const latinPath = resolve(root, 'test-fixtures/fonts/harfbuzz-validation/NotoSans-wdth-wght.ttf')
const symbolsPath = resolve(
  root,
  'test-fixtures/fonts/harfbuzz-validation/NotoSansSymbols2-Regular.ttf',
)

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

async function writeObservation(name: string, value: unknown) {
  validateObservation(value)
  await writeFile(resolve(artifacts, name), `${JSON.stringify(value, null, 2)}\n`)
}

function environment() {
  return { node: process.version, platform: `${process.platform}-${process.arch}` }
}

function payload(bytes: Uint8Array, glyphId: number) {
  const version = colrVersion(bytes)
  if (version === 0) {
    const layers = colrV0Layers(bytes, glyphId)
    return {
      kind: 'colr-v0',
      available: Boolean(layers?.length),
      layers: layers ?? [],
      paletteEntries: cpalPalette(bytes)?.length ?? 0,
    }
  }
  if (version === 1) return { kind: 'colr-v1', available: true, paintGraph: 'present-unparsed' }
  const strikes = sbixStrikes(bytes)
  if (strikes.length > 0) return { kind: 'sbix', available: true, strikes }
  const documents = svgDocumentRanges(bytes)
  if (documents.length > 0) return { kind: 'svg', available: true, documents }
  return { kind: 'outline', available: false }
}

function compactLayout(layout: LayoutResult, colorBytes: Uint8Array) {
  return {
    fontKeys: layout.fontKeys,
    blockBounds: layout.blockBounds,
    visibleBounds: layout.visibleBounds,
    lines: layout.lines,
    carets: layout.carets,
    selections: getSelectionRects(layout, { start: 0, end: layout.sourceLengthUtf16 }),
    glyphs: layout.glyphs.map((glyph) => ({
      start: glyph.start,
      end: glyph.end,
      fontKey: glyph.fontKey,
      styleKey: glyph.styleKey,
      glyphId: glyph.glyphId,
      x: glyph.x,
      y: glyph.y,
      xAdvance: glyph.xAdvance,
      variations: glyph.variations,
      colorPayload: glyph.fontKey === 'emoji' ? payload(colorBytes, glyph.glyphId) : null,
    })),
  }
}

async function recordRuntime() {
  const runtime = await productionRuntimeInventory(root)
  await writeObservation('runtime-inventory.json', {
    schemaVersion: '1',
    kind: 'harfbuzz-runtime-inventory',
    environment: environment(),
    evidence: [
      { source: 'packages/font/src/internal/vendor/harfbuzz.wasm', integrity: runtime.wasmSha256 },
      { source: 'harfbuzzjs wrapper', integrity: runtime.wrapperRevision },
      { source: 'embedded HarfBuzz', integrity: runtime.harfbuzzRevision },
    ],
    runtime,
    relevantExports: {
      rawTable: runtime.exports.includes('hb_face_reference_table'),
      drawOutline: runtime.exports.includes('hb_font_draw_glyph'),
      ...colorExportInventory(runtime.exports),
    },
  })
}

async function recordFormatProbes(fixtures: readonly FixtureEvidence[]) {
  const probes = []
  for (const fixture of fixtures) {
    const bytes = await readFile(resolve(root, fixture.path))
    const font = await loadFont(bytes)
    try {
      const shapedCases = fixture.sequences.map((text) => {
        const shaped = font.shape({ text, direction: 'ltr', script: 'Zyyy', language: 'und' })
        return {
          text,
          glyphs: shaped.glyphs,
          payloads: shaped.glyphs.map((glyph) => payload(bytes, glyph.glyphId)),
        }
      })
      probes.push({
        format: fixture.format,
        fixture: fixture.path,
        sha256: fixture.sha256,
        bytes: fixture.bytes,
        tables: tableInventory(bytes),
        facts: font.facts,
        colrVersion: colrVersion(bytes),
        palette: cpalPalette(bytes),
        bitmapStrikes: sbixStrikes(bytes),
        svgDocuments: svgDocumentRanges(bytes),
        shapedCases,
        access: 'bounded private SFNT table reader over the same caller-owned bytes',
      })
    } finally {
      font.dispose()
    }
  }
  await writeObservation('format-probes.json', {
    schemaVersion: '1',
    kind: 'color-format-probes',
    environment: environment(),
    evidence: fixtures.map((fixture) => ({ source: fixture.path, integrity: fixture.sha256 })),
    probes,
    limitations: [
      'COLR v1 paint nodes are inventoried but intentionally not normalized or interpreted.',
      'sbix bytes are located but not decoded into a second general image abstraction.',
      'SVG document ranges are located but documents are not executed or rasterized.',
    ],
  })
}

function style(key: string, fontKeys: readonly string[], fontSize = 24): TextStyle {
  return { key, fontKeys, fontSize, language: 'und' }
}

async function recordPresentation(
  emojiBytes: Uint8Array,
  latinBytes: Uint8Array,
  symbolsBytes: Uint8Array,
) {
  const emoji = await loadFont(emojiBytes)
  const latin = await loadFont(latinBytes)
  const symbols = await loadFont(symbolsBytes)
  const fonts = new Map<string, FontHandle>([
    ['emoji', emoji],
    ['latin', latin],
    ['symbols', symbols],
  ])
  const cases: Array<{
    id: string
    text: string
    base: TextStyle
    ranges?: Array<{ start: number; end: number; style: TextStyle }>
  }> = [
    { id: 'default-emoji', text: '😀', base: style('emoji', ['emoji', 'latin']) },
    { id: 'text-presentation', text: '❤\uFE0E', base: style('text', ['symbols', 'emoji']) },
    { id: 'emoji-presentation', text: '❤\uFE0F', base: style('emoji', ['emoji', 'latin']) },
    { id: 'modifier', text: '✍🏽', base: style('emoji', ['emoji', 'latin']) },
    { id: 'flag', text: '🇺🇸', base: style('emoji', ['emoji', 'latin']) },
    { id: 'zwj', text: '👩‍💻', base: style('emoji', ['emoji', 'latin']) },
    { id: 'ordinary-outline-fallback', text: 'A', base: style('fallback', ['emoji', 'latin']) },
    { id: 'text-first-capture', text: '❤', base: style('text-first', ['symbols', 'emoji']) },
    {
      id: 'styled-transition',
      text: 'A😀B',
      base: style('latin-small', ['latin', 'emoji'], 18),
      ranges: [{ start: 1, end: 3, style: style('emoji-large-red', ['emoji', 'latin'], 36) }],
    },
  ]
  const observations = cases.map((item) => {
    const prepared = prepareText({
      text: item.text,
      paragraphDirection: 'ltr',
      style: item.base,
      ...(item.ranges ? { styleRanges: item.ranges } : {}),
    })
    const layout = layoutPreparedText(prepared, fonts)
    return { id: item.id, prepared, layout: compactLayout(layout, emojiBytes) }
  })
  let missingGlyph: unknown
  try {
    layoutPreparedText(
      prepareText({ text: '🫠', style: style('missing', ['emoji', 'latin']) }),
      fonts,
    )
  } catch (error) {
    missingGlyph =
      error instanceof Error ? { name: error.name, message: error.message } : String(error)
  }
  await writeObservation('presentation-and-layout.json', {
    schemaVersion: '1',
    kind: 'presentation-shaping-layout',
    environment: environment(),
    evidence: [
      {
        source: 'test-fixtures/fonts/color-glyph-validation/noto-validation-colr-v0.ttf',
        integrity: sha256(emojiBytes),
      },
      {
        source: 'test-fixtures/fonts/harfbuzz-validation/NotoSans-wdth-wght.ttf',
        integrity: sha256(latinBytes),
      },
      {
        source: 'test-fixtures/fonts/harfbuzz-validation/NotoSansSymbols2-Regular.ttf',
        integrity: sha256(symbolsBytes),
      },
    ],
    cases: observations,
    missingGlyph,
    decision: {
      layoutResultChange: 'not-required',
      reason: 'final fontKey, glyphId, variations, scale, and placement resolve color lazily',
      fontOrder:
        'explicit caller order is deterministic; text-first can intentionally capture U+2764',
      presentationPolicy:
        'defer an explicit emoji-presentation preference until demanded by product API',
    },
  })
  emoji.dispose()
  latin.dispose()
  symbols.dispose()
}

async function recordCandidateDecision(fixtures: readonly FixtureEvidence[]) {
  const inputs: Array<Omit<CandidateScore, 'total'>> = [
    {
      format: 'colr-v0',
      usefulCoverage: 4,
      scalability: 5,
      paletteAndForeground: 4,
      variation: 3,
      engineAccess: 5,
      bundleAndCacheCost: 5,
      rendererComplexity: 5,
      browserEsm: 5,
      lifecycle: 5,
      provenance: 5,
      decision: 'select',
      limitations: [
        'Layered solid fills only; gradients, transforms, and compositing require COLR v1.',
        'Foreground-color sentinel is supported by the resolver but absent from this source corpus.',
        'Coverage is proven for the accepted validation corpus, not every deployed emoji font.',
      ],
    },
    {
      format: 'colr-v1',
      usefulCoverage: 5,
      scalability: 5,
      paletteAndForeground: 5,
      variation: 5,
      engineAccess: 3,
      bundleAndCacheCost: 4,
      rendererComplexity: 1,
      browserEsm: 5,
      lifecycle: 4,
      provenance: 5,
      decision: 'reject',
      limitations: [
        'The accepted fixture contains a paint graph that the production runtime does not export.',
        'Partial paint-node support would misrepresent unsupported gradients and composition as support.',
      ],
    },
    {
      format: 'sbix',
      usefulCoverage: 4,
      scalability: 1,
      paletteAndForeground: 1,
      variation: 1,
      engineAccess: 4,
      bundleAndCacheCost: 2,
      rendererComplexity: 3,
      browserEsm: 5,
      lifecycle: 4,
      provenance: 5,
      decision: 'reject',
      limitations: [
        'The fixture provides one 109 ppem strike, so quality depends on target size.',
        'PNG decoding and size-specific RGBA cache ownership would be a second resource path.',
      ],
    },
    {
      format: 'svg',
      usefulCoverage: 5,
      scalability: 5,
      paletteAndForeground: 1,
      variation: 3,
      engineAccess: 4,
      bundleAndCacheCost: 1,
      rendererComplexity: 1,
      browserEsm: 3,
      lifecycle: 2,
      provenance: 5,
      decision: 'reject',
      limitations: [
        'A safe SVG sanitizer and rasterizer would add a large untrusted-document surface.',
        'Browser canvas would violate the renderer-neutral ownership target.',
      ],
    },
  ]
  const scores: CandidateScore[] = inputs.map((candidate) => ({
    ...candidate,
    total:
      candidate.usefulCoverage +
      candidate.scalability +
      candidate.paletteAndForeground +
      candidate.variation +
      candidate.engineAccess +
      candidate.bundleAndCacheCost +
      candidate.rendererComplexity +
      candidate.browserEsm +
      candidate.lifecycle +
      candidate.provenance,
  }))
  await writeObservation('candidate-decision.json', {
    schemaVersion: '1',
    kind: 'candidate-matrix',
    environment: environment(),
    evidence: [
      { source: 'format-probes.json', integrity: 'validated observation' },
      { source: 'harfbuzz-bridge.json', integrity: 'reproducible bridge measurement' },
      { source: 'presentation-and-layout.json', integrity: 'public boundary observation' },
      ...fixtures.map((fixture) => ({ source: fixture.path, integrity: fixture.sha256 })),
    ],
    scale: '0 (unacceptable) through 5 (strongest); equal criterion weights',
    scores,
    checkpoint: {
      outcome: 'go',
      selected: 'colr-v0',
      accessPath: 'bounded COLR v0 and CPAL table reader over caller-owned font bytes',
      reason:
        'It passes the complete accepted corpus, stays scalable, reuses the existing outline/SDF path per layer, and avoids the 31,884-byte universal HarfBuzz color bridge delta.',
      externalDecoder: 'rejected: neither a second font parser nor image/SVG decoder is required',
      layoutResult: 'unchanged',
      productionFollowUp:
        'add one lazy COLR v0 font capability and renderer-owned layered resource composition',
    },
  })
}

async function main() {
  await mkdir(artifacts, { recursive: true })
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    fixtures: FixtureEvidence[]
  }
  await recordRuntime()
  await recordFormatProbes(manifest.fixtures)
  await recordPresentation(
    await readFile(resolve(fixtureRoot, 'noto-validation-colr-v0.ttf')),
    await readFile(latinPath),
    await readFile(symbolsPath),
  )
  await recordCandidateDecision(manifest.fixtures)
}

await main()

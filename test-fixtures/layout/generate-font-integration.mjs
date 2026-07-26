import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { loadFont } from '../../packages/font/dist/index.js'

const fontRoot = new URL('../fonts/harfbuzz-validation/', import.meta.url)
const manifestUrl = new URL('fixtures.json', fontRoot)
const outputUrl = new URL('./font-integration.json', import.meta.url)

const fonts = {
  latin: { key: 'noto-sans-variable-ttf', file: 'NotoSans-wdth-wght.ttf' },
  arabic: { key: 'noto-sans-arabic-variable', file: 'NotoSansArabic-wdth-wght.ttf' },
  devanagari: { key: 'noto-sans-devanagari-variable', file: 'NotoSansDevanagari-wdth-wght.ttf' },
  khmer: { key: 'noto-sans-khmer-variable', file: 'NotoSansKhmer-wdth-wght.ttf' },
  symbols: { key: 'noto-sans-symbols2', file: 'NotoSansSymbols2-Regular.ttf' },
}

const plans = [
  {
    id: 'latin-ligature',
    text: 'office café',
    runs: [{ start: 0, end: 11, font: 'latin', direction: 'ltr', script: 'Latn', language: 'en', features: ['liga=1'] }],
  },
  {
    id: 'combining-mark',
    text: 'Á',
    runs: [{ start: 0, end: 2, font: 'latin', direction: 'ltr', script: 'Latn', language: 'en' }],
  },
  {
    id: 'arabic-rtl',
    text: 'السَّلَامُ عَلَيْكُمْ',
    runs: [{ start: 0, end: 21, font: 'arabic', direction: 'rtl', script: 'Arab', language: 'ar' }],
  },
  {
    id: 'devanagari',
    text: 'नमस्ते दुनिया',
    runs: [{ start: 0, end: 13, font: 'devanagari', direction: 'ltr', script: 'Deva', language: 'hi' }],
  },
  {
    id: 'khmer',
    text: 'សួស្តី​ពិភពលោក',
    runs: [{ start: 0, end: 14, font: 'khmer', direction: 'ltr', script: 'Khmr', language: 'km' }],
  },
  {
    id: 'supplementary-plane',
    text: '𐅀',
    runs: [{ start: 0, end: 2, font: 'symbols', direction: 'ltr', script: 'Grek', language: 'el' }],
  },
  {
    id: 'fallback-font',
    text: 'A𐅀',
    runs: [
      { start: 0, end: 1, font: 'latin', direction: 'ltr', script: 'Latn', language: 'en' },
      { start: 1, end: 3, font: 'symbols', direction: 'ltr', script: 'Grek', language: 'el' },
    ],
  },
  {
    id: 'variable-axis',
    text: 'wide',
    runs: [{ start: 0, end: 4, font: 'latin', direction: 'ltr', script: 'Latn', language: 'en', variations: { wdth: 75, wght: 700 } }],
  },
  {
    id: 'mixed-direction',
    text: 'WebGPU مرحبا',
    runs: [
      { start: 0, end: 7, font: 'latin', direction: 'ltr', script: 'Latn', language: 'en' },
      { start: 7, end: 12, font: 'arabic', direction: 'rtl', script: 'Arab', language: 'ar' },
    ],
  },
]

const handles = new Map()

async function fontHandle(name) {
  let handle = handles.get(name)
  if (!handle) {
    const fixture = fonts[name]
    handle = await loadFont(new Uint8Array(await readFile(new URL(fixture.file, fontRoot))))
    handles.set(name, handle)
  }
  return handle
}

try {
  for (const plan of plans) {
    for (const descriptor of plan.runs) {
      const fixture = fonts[descriptor.font]
      const handle = await fontHandle(descriptor.font)
      const text = plan.text.slice(descriptor.start, descriptor.end)
      const input = {
        text,
        direction: descriptor.direction,
        script: descriptor.script,
        language: descriptor.language,
        ...(descriptor.features ? { features: descriptor.features } : {}),
        ...(descriptor.variations ? { variations: descriptor.variations } : {}),
      }
      const shaped = handle.shape(input)
      descriptor.fontKey = fixture.key
      descriptor.fontFile = fixture.file
      descriptor.input = input
      descriptor.resolved = {
        start: descriptor.start,
        end: descriptor.end,
        direction: shaped.direction,
        bidiLevel: shaped.direction === 'rtl' ? 1 : 0,
        script: shaped.script,
        language: shaped.language,
        styleKey: 'default',
        fontKey: fixture.key,
        fontSize: handle.facts.unitsPerEm,
        fontUnitScale: 1,
        metrics: {
          ascender: handle.facts.ascender,
          descender: handle.facts.descender,
          lineGap: handle.facts.lineGap,
          decorationMetrics: handle.facts.decorationMetrics,
        },
        variations: shaped.variations,
        glyphs: shaped.glyphs.map((glyph) => ({
          glyphId: glyph.glyphId,
          start: descriptor.start + glyph.clusterStart,
          end: descriptor.start + glyph.clusterEnd,
          xAdvance: glyph.xAdvance,
          yAdvance: glyph.yAdvance,
          xOffset: glyph.xOffset,
          yOffset: glyph.yOffset,
          flags: glyph.flags,
          bounds: null,
        })),
      }
      delete descriptor.font
      delete descriptor.direction
      delete descriptor.script
      delete descriptor.language
      delete descriptor.features
      delete descriptor.variations
    }
  }
} finally {
  for (const handle of handles.values()) handle.dispose()
}

const manifest = await readFile(manifestUrl)
const document = {
  schemaVersion: 1,
  source: '@text-rendering-toolkit/font public entry point',
  fontManifest: {
    file: 'test-fixtures/fonts/harfbuzz-validation/fixtures.json',
    sha256: createHash('sha256').update(manifest).digest('hex'),
  },
  plans,
}

await writeFile(outputUrl, `${JSON.stringify(document, null, 2)}\n`)

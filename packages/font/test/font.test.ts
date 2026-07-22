import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  DisposedFontHandleError,
  type FontHandle,
  InvalidFontError,
  InvalidFontInputError,
  InvalidShapingInputError,
  loadFont,
  OutlineCommand,
  type ShapeInput,
  UnsupportedFontFormatError,
} from '../src/index.js'

const fixtureRoot = new URL('../../../test-fixtures/fonts/harfbuzz-validation/', import.meta.url)
const colorFixtureRoot = new URL(
  '../../../test-fixtures/fonts/color-glyph-validation/',
  import.meta.url,
)

const fixtures = {
  latin: 'NotoSans-wdth-wght.ttf',
  arabic: 'NotoSansArabic-wdth-wght.ttf',
  devanagari: 'NotoSansDevanagari-wdth-wght.ttf',
  khmer: 'NotoSansKhmer-wdth-wght.ttf',
  symbols: 'NotoSansSymbols2-Regular.ttf',
  cff: 'SourceSans3-Regular.otf',
  woff: 'NotoSans-wdth-wght.woff',
  woff2: 'NotoSans-wdth-wght.woff2',
} as const

async function fixture(name: (typeof fixtures)[keyof typeof fixtures]): Promise<Uint8Array> {
  return readFile(new URL(name, fixtureRoot))
}

async function open(name: (typeof fixtures)[keyof typeof fixtures]): Promise<FontHandle> {
  const bytes = await fixture(name)
  return loadFont(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength))
}

async function colorFixture(name: 'colr-v0' | 'colr-v1'): Promise<Uint8Array> {
  return readFile(new URL(`noto-validation-${name}.ttf`, colorFixtureRoot))
}

function sfntTable(
  bytes: Uint8Array,
  name: string,
): { readonly offset: number; readonly length: number } {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const count = data.getUint16(4, false)
  for (let index = 0; index < count; index += 1) {
    const record = 12 + index * 16
    const tag = String.fromCharCode(...bytes.subarray(record, record + 4))
    if (tag === name) {
      return {
        offset: data.getUint32(record + 8, false),
        length: data.getUint32(record + 12, false),
      }
    }
  }
  throw new Error(`Missing ${name} table`)
}

function firstLayerPaletteOffset(bytes: Uint8Array, glyphId: number): number {
  const { offset } = sfntTable(bytes, 'COLR')
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const baseCount = data.getUint16(offset + 2, false)
  const baseOffset = offset + data.getUint32(offset + 4, false)
  const layerOffset = offset + data.getUint32(offset + 8, false)
  for (let index = 0; index < baseCount; index += 1) {
    const record = baseOffset + index * 6
    if (data.getUint16(record, false) === glyphId) {
      return layerOffset + data.getUint16(record + 2, false) * 4 + 2
    }
  }
  throw new Error(`Missing COLR base glyph ${glyphId}`)
}

function paletteColorAlphaOffset(bytes: Uint8Array, paletteIndex: number): number {
  const { offset } = sfntTable(bytes, 'CPAL')
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const firstColor = data.getUint16(offset + 12, false)
  const recordsOffset = data.getUint32(offset + 8, false)
  return offset + recordsOffset + (firstColor + paletteIndex) * 4 + 3
}

const shapeCases: readonly {
  readonly id: string
  readonly fixture: keyof Pick<
    typeof fixtures,
    'latin' | 'arabic' | 'devanagari' | 'khmer' | 'symbols'
  >
  readonly input: ShapeInput
}[] = [
  {
    id: 'latin-ligature',
    fixture: 'latin',
    input: {
      text: 'office café',
      direction: 'ltr',
      script: 'Latn',
      language: 'en',
      features: ['liga=1'],
    },
  },
  {
    id: 'combining-mark',
    fixture: 'latin',
    input: { text: 'A\u0301', direction: 'ltr', script: 'Latn', language: 'en' },
  },
  {
    id: 'arabic-rtl',
    fixture: 'arabic',
    input: { text: 'السَّلَامُ عَلَيْكُمْ', direction: 'rtl', script: 'Arab', language: 'ar' },
  },
  {
    id: 'mixed-direction-latin-run',
    fixture: 'latin',
    input: { text: 'WebGPU ', direction: 'ltr', script: 'Latn', language: 'en' },
  },
  {
    id: 'mixed-direction-arabic-run',
    fixture: 'arabic',
    input: { text: 'مرحبا', direction: 'rtl', script: 'Arab', language: 'ar' },
  },
  {
    id: 'devanagari',
    fixture: 'devanagari',
    input: { text: 'नमस्ते दुनिया', direction: 'ltr', script: 'Deva', language: 'hi' },
  },
  {
    id: 'khmer',
    fixture: 'khmer',
    input: { text: 'សួស្តី​ពិភពលោក', direction: 'ltr', script: 'Khmr', language: 'km' },
  },
  {
    id: 'supplementary-plane',
    fixture: 'symbols',
    input: { text: '𐅀', direction: 'ltr', script: 'Grek', language: 'el' },
  },
]

describe('font loading and facts', () => {
  it('loads TTF and CFF fonts with normalized facts and coverage', async () => {
    for (const name of [fixtures.latin, fixtures.cff]) {
      const font = await open(name)
      expect(font.facts.unitsPerEm).toBe(1000)
      expect(font.facts.coverageCount).toBeGreaterThan(0)
      expect(font.supports('A'.codePointAt(0) ?? 0)).toBe(true)
      expect(font.supports(0x10ffff)).toBe(false)
      font.dispose()
    }

    const variable = await open(fixtures.latin)
    expect(variable.facts).toMatchObject({ ascender: 1069, descender: -293, lineGap: 0 })
    expect(variable.facts.axes).toEqual([
      { tag: 'wdth', min: 62.5, default: 100, max: 100 },
      { tag: 'wght', min: 100, default: 400, max: 900 },
    ])
    variable.dispose()
  })

  it('copies exactly a Uint8Array view and owns the loaded bytes', async () => {
    const original = await fixture(fixtures.latin)
    const padded = new Uint8Array(original.byteLength + 32)
    padded.fill(0xff)
    padded.set(original, 16)
    const view = padded.subarray(16, 16 + original.byteLength)
    const font = await loadFont(view)
    view.fill(0)

    expect(font.facts.unitsPerEm).toBe(1000)
    expect(
      font.shape({ text: 'A', direction: 'ltr', script: 'Latn', language: 'en' }).glyphs[0]
        ?.glyphId,
    ).toBe(36)
    font.dispose()
  })

  it('rejects unsupported and invalid containers with stable errors', async () => {
    await expect(open(fixtures.woff)).rejects.toMatchObject({
      name: UnsupportedFontFormatError.name,
      format: 'woff',
    })
    await expect(open(fixtures.woff2)).rejects.toMatchObject({
      name: UnsupportedFontFormatError.name,
      format: 'woff2',
    })
    await expect(loadFont(new Uint8Array())).rejects.toBeInstanceOf(InvalidFontError)
    await expect(loadFont(Uint8Array.from([0, 1, 0, 0]))).rejects.toBeInstanceOf(InvalidFontError)
    const collection = new Uint8Array(12)
    collection.set(new TextEncoder().encode('ttcf'))
    await expect(loadFont(collection)).rejects.toThrow('Font collections are not supported')

    const valid = await open(fixtures.latin)
    expect(valid.facts.coverageCount).toBeGreaterThan(0)
    valid.dispose()
  })

  it('validates scalar values and explicit shaping inputs', async () => {
    const font = await open(fixtures.latin)
    expect(() => font.supports(0xd800)).toThrow(InvalidFontInputError)
    expect(() => font.supports(0x110000)).toThrow(InvalidFontInputError)
    expect(() =>
      font.shape({ text: 'A', direction: 'toString' as 'ltr', script: 'Latn', language: 'en' }),
    ).toThrow(InvalidShapingInputError)
    expect(() =>
      font.shape({ text: 'A', direction: 'ltr', script: 'Latin', language: 'en' }),
    ).toThrow(InvalidShapingInputError)
    expect(() =>
      font.shape({
        text: 'A',
        direction: 'ltr',
        script: 'Latn',
        language: 'en',
        features: [''],
      }),
    ).toThrow(InvalidShapingInputError)
    expect(() =>
      font.shape({
        text: 'A',
        direction: 'ltr',
        script: 'Latn',
        language: 'en',
        variations: { oops: 1 },
      }),
    ).toThrow(InvalidShapingInputError)
    font.dispose()
  })
})

describe('shaping', () => {
  it('matches the accepted multilingual observations and UTF-16 ranges', async () => {
    const expected = JSON.parse(
      await readFile(new URL('expected-shaping.json', fixtureRoot), 'utf8'),
    ) as Record<string, unknown>

    for (const shapeCase of shapeCases) {
      const font = await open(fixtures[shapeCase.fixture])
      const run = font.shape(shapeCase.input)
      expect({ textLengthUtf16: run.textLengthUtf16, glyphs: run.glyphs }).toEqual(
        expected[shapeCase.id],
      )
      for (const glyph of run.glyphs) {
        expect(glyph.clusterStart).toBeGreaterThanOrEqual(0)
        expect(glyph.clusterEnd).toBeGreaterThan(glyph.clusterStart)
        expect(glyph.clusterEnd).toBeLessThanOrEqual(shapeCase.input.text.length)
        expect(glyph.sourceText).toBe(
          shapeCase.input.text.slice(glyph.clusterStart, glyph.clusterEnd),
        )
        expect(Number.isFinite(glyph.xAdvance)).toBe(true)
        expect(Number.isFinite(glyph.yAdvance)).toBe(true)
        expect(Number.isFinite(glyph.xOffset)).toBe(true)
        expect(Number.isFinite(glyph.yOffset)).toBe(true)
      }
      font.dispose()
    }
  })
})

describe('numeric outlines and variations', () => {
  it('returns direct TTF and CFF commands with valid arity and enclosing bounds', async () => {
    const arity: Readonly<Record<number, number>> = {
      [OutlineCommand.MOVE_TO]: 2,
      [OutlineCommand.LINE_TO]: 2,
      [OutlineCommand.QUADRATIC_TO]: 4,
      [OutlineCommand.CUBIC_TO]: 6,
      [OutlineCommand.CLOSE_PATH]: 0,
    }

    for (const name of [fixtures.latin, fixtures.cff]) {
      const font = await open(name)
      const glyphId = font.shape({
        text: 'A',
        direction: 'ltr',
        script: 'Latn',
        language: 'en',
      }).glyphs[0]?.glyphId
      expect(glyphId).toBeDefined()
      const outline = font.getOutline(glyphId ?? 0)
      expect(outline.commands.length).toBeGreaterThan(0)
      let coordinateCount = 0
      for (const command of outline.commands) coordinateCount += arity[command] ?? -1
      expect(coordinateCount).toBe(outline.coordinates.length)
      for (let index = 0; index < outline.coordinates.length; index += 2) {
        const x = outline.coordinates[index] ?? Number.NaN
        const y = outline.coordinates[index + 1] ?? Number.NaN
        expect(x).toBeGreaterThanOrEqual(outline.bounds.xMin)
        expect(x).toBeLessThanOrEqual(outline.bounds.xMax)
        expect(y).toBeGreaterThanOrEqual(outline.bounds.yMin)
        expect(y).toBeLessThanOrEqual(outline.bounds.yMax)
      }
      expect(font.getOutline(glyphId ?? 0)).toBe(outline)
      font.dispose()
    }
  })

  it('returns deterministic empty glyphs and isolates variation call order', async () => {
    const font = await open(fixtures.latin)
    const space = font.shape({
      text: ' ',
      direction: 'ltr',
      script: 'Latn',
      language: 'en',
    }).glyphs[0]
    const empty = font.getOutline(space?.glyphId ?? 0)
    expect(empty.commands).toHaveLength(0)
    expect(empty.coordinates).toHaveLength(0)
    expect(empty.bounds).toEqual({ xMin: 0, yMin: 0, xMax: 0, yMax: 0 })

    const glyphId = font.shape({
      text: 'A',
      direction: 'ltr',
      script: 'Latn',
      language: 'en',
      variations: { wght: 400 },
    }).glyphs[0]?.glyphId
    const regular = font.getOutline(glyphId ?? 0, { wght: 400 })
    const bold = font.getOutline(glyphId ?? 0, { wght: 900 })
    expect(Array.from(bold.coordinates)).not.toEqual(Array.from(regular.coordinates))
    expect(font.getOutline(glyphId ?? 0, { wght: 400 })).toBe(regular)
    expect(
      font.shape({
        text: 'A',
        direction: 'ltr',
        script: 'Latn',
        language: 'en',
        variations: { wght: 900 },
      }).variations,
    ).toEqual({ wght: 900 })
    expect(font.getOutline(glyphId ?? 0, { wght: 400 })).toBe(regular)
    font.dispose()
  })
})

describe('COLR v0 color layers', () => {
  it('returns ordered immutable palette-zero layers for the accepted emoji corpus', async () => {
    const font = await loadFont(await colorFixture('colr-v0'))
    for (const text of ['✍', '✍🏻', '✍🏽', '✍🏿', '😀', '❤', '👨‍👩‍👧', '👩‍💻', '🇺🇸']) {
      const run = font.shape({ text, direction: 'ltr', script: 'Zyyy', language: 'und' })
      expect(run.glyphs).toHaveLength(1)
      const glyphId = run.glyphs[0]?.glyphId ?? 0
      const layers = font.getColorLayers(glyphId)
      expect(layers?.length).toBeGreaterThan(0)
      expect(Object.isFrozen(layers)).toBe(true)
      for (const layer of layers ?? []) {
        expect(Object.isFrozen(layer)).toBe(true)
        expect(font.getOutline(layer.glyphId).commands.length).toBeGreaterThan(0)
        if (layer.color !== 'foreground') {
          expect(Object.isFrozen(layer.color)).toBe(true)
          expect(Object.values(layer.color).every((value) => value >= 0 && value <= 255)).toBe(true)
        }
      }
      expect(font.getColorLayers(glyphId)).toBe(layers)
    }
    font.dispose()
  })

  it('supports current foreground and CPAL alpha without changing public table semantics', async () => {
    const bytes = await colorFixture('colr-v0')
    const probe = await loadFont(bytes)
    const glyphId =
      probe.shape({ text: '😀', direction: 'ltr', script: 'Zyyy', language: 'und' }).glyphs[0]
        ?.glyphId ?? 0
    const originalLayers = probe.getColorLayers(glyphId)
    const firstColor = originalLayers?.[0]?.color
    expect(firstColor).not.toBe('foreground')
    probe.dispose()

    const foregroundBytes = Uint8Array.from(bytes)
    new DataView(foregroundBytes.buffer).setUint16(
      firstLayerPaletteOffset(foregroundBytes, glyphId),
      0xffff,
      false,
    )
    const foregroundFont = await loadFont(foregroundBytes)
    expect(foregroundFont.getColorLayers(glyphId)?.[0]?.color).toBe('foreground')
    foregroundFont.dispose()

    if (firstColor === undefined || firstColor === 'foreground')
      throw new Error('Expected palette color')
    const alphaBytes = Uint8Array.from(bytes)
    const paletteOffset = firstLayerPaletteOffset(alphaBytes, glyphId)
    const paletteIndex = new DataView(alphaBytes.buffer).getUint16(paletteOffset, false)
    alphaBytes[paletteColorAlphaOffset(alphaBytes, paletteIndex)] = 128
    const alphaFont = await loadFont(alphaBytes)
    expect(alphaFont.getColorLayers(glyphId)?.[0]?.color).toMatchObject({ alpha: 128 })
    alphaFont.dispose()
  })

  it('returns null for ordinary and unsupported color formats and rejects malformed v0 data', async () => {
    const ordinary = await open(fixtures.latin)
    const ordinaryGlyph =
      ordinary.shape({ text: 'A', direction: 'ltr', script: 'Latn', language: 'en' }).glyphs[0]
        ?.glyphId ?? 0
    expect(ordinary.getColorLayers(ordinaryGlyph)).toBeNull()
    expect(ordinary.getColorLayers(ordinaryGlyph)).toBeNull()
    ordinary.dispose()

    const versionOne = await loadFont(await colorFixture('colr-v1'))
    const colorGlyph =
      versionOne.shape({ text: '😀', direction: 'ltr', script: 'Zyyy', language: 'und' }).glyphs[0]
        ?.glyphId ?? 0
    expect(versionOne.getColorLayers(colorGlyph)).toBeNull()
    versionOne.dispose()

    const malformed = await colorFixture('colr-v0')
    const malformedProbe = await loadFont(malformed)
    const malformedGlyph =
      malformedProbe.shape({
        text: '😀',
        direction: 'ltr',
        script: 'Zyyy',
        language: 'und',
      }).glyphs[0]?.glyphId ?? 0
    malformedProbe.dispose()
    new DataView(malformed.buffer, malformed.byteOffset, malformed.byteLength).setUint16(
      firstLayerPaletteOffset(malformed, malformedGlyph),
      0xfffe,
      false,
    )
    const invalid = await loadFont(malformed)
    expect(() => invalid.getColorLayers(malformedGlyph)).toThrow(InvalidFontError)
    invalid.dispose()
  })

  it('owns the source bytes used by lazy color lookup', async () => {
    const source = await colorFixture('colr-v0')
    const font = await loadFont(source)
    source.fill(0)
    const glyphId =
      font.shape({ text: '😀', direction: 'ltr', script: 'Zyyy', language: 'und' }).glyphs[0]
        ?.glyphId ?? 0
    expect(font.getColorLayers(glyphId)?.length).toBeGreaterThan(0)
    font.dispose()
  })
})

describe('lifecycle', () => {
  it('disposes idempotently and rejects every live-handle operation afterward', async () => {
    const font = await open(fixtures.latin)
    const glyphId = font.shape({
      text: 'A',
      direction: 'ltr',
      script: 'Latn',
      language: 'en',
    }).glyphs[0]?.glyphId
    font.getOutline(glyphId ?? 0)
    font.dispose()
    expect(() => font.dispose()).not.toThrow()
    expect(() => font.facts).toThrow(DisposedFontHandleError)
    expect(() => font.supports(65)).toThrow(DisposedFontHandleError)
    expect(() =>
      font.shape({ text: 'A', direction: 'ltr', script: 'Latn', language: 'en' }),
    ).toThrow(DisposedFontHandleError)
    expect(() => font.getOutline(glyphId ?? 0)).toThrow(DisposedFontHandleError)
    expect(() => font.getColorLayers(glyphId ?? 0)).toThrow(DisposedFontHandleError)
  })
})

it('keeps fixture paths auditable', () => {
  expect(fileURLToPath(fixtureRoot)).toContain('test-fixtures/fonts/harfbuzz-validation')
})

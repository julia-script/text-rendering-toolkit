import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type GlyphOutline, loadFont, OutlineCommand } from '@text-rendering-toolkit/font'
import { expect, test } from 'vitest'
import { generateSdf, type SdfOutline } from '../src/index.js'

const fixtures = resolve(
  fileURLToPath(new URL('../../../test-fixtures/fonts/harfbuzz-validation/', import.meta.url)),
)

async function load(file: string) {
  const bytes = await readFile(resolve(fixtures, file))
  return loadFont(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength))
}

function generate(outline: GlyphOutline, unitsPerEm: number) {
  const structural: SdfOutline = outline
  const padding = unitsPerEm / 10
  return generateSdf({
    outline: structural,
    viewBox: {
      left: outline.bounds.xMin - padding,
      bottom: outline.bounds.yMin - padding,
      right: outline.bounds.xMax + padding,
      top: outline.bounds.yMax + padding,
    },
    width: 24,
    height: 24,
    distance: padding,
    exponent: 9,
  })
}

test('accepts public TrueType and CFF outlines without conversion', async () => {
  const ttf = await load('NotoSans-wdth-wght.ttf')
  const otf = await load('SourceSans3-Regular.otf')
  try {
    const ttfRun = ttf.shape({ text: 'S', direction: 'ltr', script: 'Latn', language: 'en' })
    const otfRun = otf.shape({ text: 'S', direction: 'ltr', script: 'Latn', language: 'en' })
    const ttfOutline = ttf.getOutline(ttfRun.glyphs[0]?.glyphId ?? 0)
    const otfOutline = otf.getOutline(otfRun.glyphs[0]?.glyphId ?? 0)
    expect([...ttfOutline.commands]).toContain(OutlineCommand.QUADRATIC_TO)
    expect([...otfOutline.commands]).toContain(OutlineCommand.CUBIC_TO)

    for (const [outline, unitsPerEm] of [
      [ttfOutline, ttf.facts.unitsPerEm],
      [otfOutline, otf.facts.unitsPerEm],
    ] as const) {
      const first = generate(outline, unitsPerEm)
      const second = generate(outline, unitsPerEm)
      expect(first.pixels).toHaveLength(24 * 24)
      expect([...first.pixels]).toEqual([...second.pixels])
      expect(first.pixels.some((value) => value > 128)).toBe(true)
      expect(first.pixels.every((value) => value >= 0 && value <= 255)).toBe(true)
    }
  } finally {
    ttf.dispose()
    otf.dispose()
  }
})

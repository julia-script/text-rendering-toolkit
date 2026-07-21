import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadFont } from '@webgpu-text/font'
import { layoutResolvedText, type ResolvedLayoutInput } from '@webgpu-text/layout'
import { expect, test, vi } from 'vitest'
import { Text, type TextFont } from '../src/index.js'

const fixtures = resolve(
  fileURLToPath(new URL('../../../test-fixtures/fonts/harfbuzz-validation/', import.meta.url)),
)

test('renders repeated public-font glyphs through one lazy outline/SDF insertion', async () => {
  const handle = await loadFont(
    new Uint8Array(await readFile(resolve(fixtures, 'NotoSans-wdth-wght.ttf'))),
  )
  try {
    const shaped = handle.shape({ text: 'SSS', direction: 'ltr', script: 'Latn', language: 'en' })
    const scale = 1 / handle.facts.unitsPerEm
    const getOutline = vi.fn(handle.getOutline.bind(handle))
    const font: TextFont = { getOutline }
    const input: ResolvedLayoutInput = {
      text: 'SSS',
      paragraphLevel: 0,
      defaultMetrics: {
        ascender: handle.facts.ascender * scale,
        descender: handle.facts.descender * scale,
        lineGap: handle.facts.lineGap * scale,
      },
      maxWidth: null,
      whiteSpace: 'normal',
      overflowWrap: 'normal',
      textAlign: 'left',
      textIndent: 0,
      letterSpacing: 0,
      lineHeight: 'normal',
      anchorX: 0,
      anchorY: 0,
      runs: [
        {
          start: 0,
          end: 3,
          direction: 'ltr',
          bidiLevel: 0,
          script: 'Latn',
          language: 'en',
          styleKey: 'default',
          fontKey: 'noto',
          fontSize: 1,
          fontUnitScale: scale,
          metrics: {
            ascender: handle.facts.ascender * scale,
            descender: handle.facts.descender * scale,
            lineGap: handle.facts.lineGap * scale,
          },
          variations: shaped.variations,
          glyphs: shaped.glyphs.map((glyph) => {
            const outline = handle.getOutline(glyph.glyphId, shaped.variations)
            return {
              glyphId: glyph.glyphId,
              start: glyph.clusterStart,
              end: glyph.clusterEnd,
              xAdvance: glyph.xAdvance * scale,
              yAdvance: glyph.yAdvance * scale,
              xOffset: glyph.xOffset * scale,
              yOffset: glyph.yOffset * scale,
              flags: glyph.flags,
              bounds: {
                left: outline.bounds.xMin * scale,
                bottom: outline.bounds.yMin * scale,
                right: outline.bounds.xMax * scale,
                top: outline.bounds.yMax * scale,
              },
            }
          }),
        },
      ],
    }
    getOutline.mockClear()
    const text = new Text({
      layout: layoutResolvedText(input),
      fonts: new Map([['noto', font]]),
      sdfSize: 16,
    })
    await text.sync()
    expect(text.geometry.instanceCount).toBe(3)
    expect(getOutline).toHaveBeenCalledTimes(1)
    expect(text.layoutResult?.visibleBounds).not.toBeNull()
    text.dispose()
    expect(handle.facts.unitsPerEm).toBeGreaterThan(0)
  } finally {
    handle.dispose()
  }
})

test('rejects a disposed public FontHandle without taking ownership', async () => {
  const handle = await loadFont(
    new Uint8Array(await readFile(resolve(fixtures, 'NotoSans-wdth-wght.ttf'))),
  )
  const input = {
    text: 'A',
    paragraphLevel: 0 as const,
    defaultMetrics: { ascender: 0.8, descender: -0.2, lineGap: 0 },
    maxWidth: null,
    whiteSpace: 'normal' as const,
    overflowWrap: 'normal' as const,
    textAlign: 'left' as const,
    textIndent: 0,
    letterSpacing: 0,
    lineHeight: 'normal' as const,
    anchorX: 0,
    anchorY: 0,
    runs: [
      {
        start: 0,
        end: 1,
        direction: 'ltr' as const,
        bidiLevel: 0 as const,
        script: 'Latn',
        language: 'en',
        styleKey: 'default',
        fontKey: 'noto',
        fontSize: 1,
        fontUnitScale: 0.001,
        metrics: { ascender: 0.8, descender: -0.2, lineGap: 0 },
        variations: {},
        glyphs: [
          {
            start: 0,
            end: 1,
            glyphId: 1,
            xAdvance: 0.5,
            yAdvance: 0,
            xOffset: 0,
            yOffset: 0,
            flags: 0,
            bounds: null,
          },
        ],
      },
    ],
  }
  const layout = layoutResolvedText(input)
  handle.dispose()
  const text = new Text({ layout, fonts: new Map([['noto', handle]]), sdfSize: 16 })
  await expect(text.sync()).rejects.toThrow('Unable to resolve outline')
  text.dispose()
})

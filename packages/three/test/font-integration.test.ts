import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadFont } from '@webgpu-text/font'
import {
  deriveTextDecorations,
  getSelectionRects,
  layoutPreparedText,
  layoutResolvedText,
  prepareText,
  type ResolvedLayoutInput,
} from '@webgpu-text/layout'
import { expect, test, vi } from 'vitest'
import { Text, type TextFont, TextResources } from '../src/index.js'

const fixtures = resolve(
  fileURLToPath(new URL('../../../test-fixtures/fonts/harfbuzz-validation/', import.meta.url)),
)
const colorFixtures = resolve(
  fileURLToPath(new URL('../../../test-fixtures/fonts/color-glyph-validation/', import.meta.url)),
)

test('renders repeated public-font glyphs through one lazy outline/SDF insertion', async () => {
  const handle = await loadFont(
    new Uint8Array(await readFile(resolve(fixtures, 'NotoSans-wdth-wght.ttf'))),
  )
  try {
    const shaped = handle.shape({ text: 'SSS', direction: 'ltr', script: 'Latn', language: 'en' })
    const scale = 1 / handle.facts.unitsPerEm
    const getOutline = vi.fn(handle.getOutline.bind(handle))
    const font: TextFont = { facts: handle.facts, getOutline }
    const input: ResolvedLayoutInput = {
      text: 'SSS',
      paragraphLevel: 0,
      defaultMetrics: {
        ascender: handle.facts.ascender * scale,
        descender: handle.facts.descender * scale,
        lineGap: handle.facts.lineGap * scale,
        decorationMetrics: {
          underlinePosition: handle.facts.decorationMetrics.underlinePosition * scale,
          underlineThickness: handle.facts.decorationMetrics.underlineThickness * scale,
          strikethroughPosition: handle.facts.decorationMetrics.strikethroughPosition * scale,
          strikethroughThickness: handle.facts.decorationMetrics.strikethroughThickness * scale,
        },
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
            decorationMetrics: {
              underlinePosition: handle.facts.decorationMetrics.underlinePosition * scale,
              underlineThickness: handle.facts.decorationMetrics.underlineThickness * scale,
              strikethroughPosition: handle.facts.decorationMetrics.strikethroughPosition * scale,
              strikethroughThickness: handle.facts.decorationMetrics.strikethroughThickness * scale,
            },
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

test('shares painted Latin and Arabic SDFs across unlit and lit borrowers', async () => {
  const latin = await loadFont(
    new Uint8Array(await readFile(resolve(fixtures, 'NotoSans-wdth-wght.ttf'))),
  )
  const arabic = await loadFont(
    new Uint8Array(await readFile(resolve(fixtures, 'NotoSansArabic-wdth-wght.ttf'))),
  )
  const latinOutline = vi.fn(latin.getOutline.bind(latin))
  const arabicOutline = vi.fn(arabic.getOutline.bind(arabic))
  const fonts = new Map([
    ['latin', latin],
    ['arabic', arabic],
  ])
  const renderFonts = new Map<string, TextFont>([
    [
      'latin',
      {
        facts: latin.facts,
        getOutline: latinOutline,
        getColorLayers: latin.getColorLayers.bind(latin),
      },
    ],
    [
      'arabic',
      {
        facts: arabic.facts,
        getOutline: arabicOutline,
        getColorLayers: arabic.getColorLayers.bind(arabic),
      },
    ],
  ])
  const resources = new TextResources({ sdfSize: 64 })
  try {
    const layout = layoutPreparedText(
      prepareText({
        text: 'Hello مرحبا',
        style: { key: 'body', fontKeys: ['latin', 'arabic'], fontSize: 1, language: 'und' },
      }),
      fonts,
    )
    const shared = {
      layout,
      fonts: renderFonts,
      resources,
      outline: { width: 0.01, color: 0x22d3ee, opacity: 0.8 },
      shadow: {
        offsetX: 0.01,
        offsetY: -0.01,
        softness: 0.01,
        color: 0x172554,
        opacity: 0.6,
      },
      clipRect: { ...layout.blockBounds },
    } as const
    const unlit = new Text(shared)
    const lit = new Text({ ...shared, lit: true })
    await unlit.sync()
    const outlineCalls = latinOutline.mock.calls.length + arabicOutline.mock.calls.length
    const slots = [...unlit.geometry.getAttribute('glyphSlot').array].slice(
      0,
      unlit.geometry.instanceCount,
    )
    await lit.sync()

    expect(layout.glyphs.some((glyph) => glyph.fontKey === 'latin')).toBe(true)
    expect(layout.glyphs.some((glyph) => glyph.fontKey === 'arabic')).toBe(true)
    expect(latinOutline.mock.calls.length + arabicOutline.mock.calls.length).toBe(outlineCalls)
    expect(
      [...lit.geometry.getAttribute('glyphSlot').array].slice(0, lit.geometry.instanceCount),
    ).toEqual(slots)
    unlit.shadow = { ...shared.shadow, offsetX: 0.02, color: 0x7c3aed }
    await unlit.sync()
    expect(latinOutline.mock.calls.length + arabicOutline.mock.calls.length).toBe(outlineCalls)
    expect(unlit.material).not.toBe(lit.material)
    unlit.dispose()
    lit.dispose()
  } finally {
    resources.dispose()
    latin.dispose()
    arabic.dispose()
  }
})

test('rejects a disposed public FontHandle without taking ownership', async () => {
  const handle = await loadFont(
    new Uint8Array(await readFile(resolve(fixtures, 'NotoSans-wdth-wght.ttf'))),
  )
  const decorationMetrics = {
    underlinePosition: -0.1,
    underlineThickness: 0.05,
    strikethroughPosition: 0.3,
    strikethroughThickness: 0.05,
  }
  const input = {
    text: 'A',
    paragraphLevel: 0 as const,
    defaultMetrics: { ascender: 0.8, descender: -0.2, lineGap: 0, decorationMetrics },
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
        metrics: { ascender: 0.8, descender: -0.2, lineGap: 0, decorationMetrics },
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
  await expect(text.sync()).rejects.toThrow('Unable to resolve color layers')
  text.dispose()
})

test('renders the accepted color corpus through unchanged public layouts at two sizes', async () => {
  const latin = await loadFont(
    new Uint8Array(await readFile(resolve(fixtures, 'NotoSans-wdth-wght.ttf'))),
  )
  const emoji = await loadFont(
    new Uint8Array(await readFile(resolve(colorFixtures, 'noto-validation-colr-v0.ttf'))),
  )
  const fontRegistry = new Map([
    ['latin', latin],
    ['emoji', emoji],
  ])
  const getOutline = vi.fn(emoji.getOutline.bind(emoji))
  const getColorLayers = vi.fn(emoji.getColorLayers.bind(emoji))
  const renderFonts = new Map<string, TextFont>([
    ['latin', latin],
    ['emoji', { facts: emoji.facts, getOutline, getColorLayers }],
  ])
  const resources = new TextResources({ sdfSize: 64, sdfPadding: 0.25 })
  const values = []
  const emojiText = '✍✍🏻✍🏽✍🏿😀❤👨‍👩‍👧👩‍💻🇺🇸'
  const textValue = `A${emojiText}B`
  try {
    for (const fontSize of [1, 2]) {
      const prepared = prepareText({
        text: textValue,
        style: { key: 'latin', fontKeys: ['latin', 'emoji'], fontSize, language: 'en' },
        styleRanges: [
          {
            start: 1,
            end: textValue.length - 1,
            style: { key: 'emoji', fontKeys: ['emoji', 'latin'], fontSize, language: 'und' },
          },
        ],
      })
      const layout = layoutPreparedText(prepared, fontRegistry)
      const decorations = deriveTextDecorations(layout, [
        {
          start: 1,
          end: textValue.length - 1,
          kind: 'underline',
          style: 'wavy',
          color: { red: 255, green: 120, blue: 0, alpha: 255 },
        },
      ])
      const rendererNeutralState = structuredClone({
        blockBounds: layout.blockBounds,
        visibleBounds: layout.visibleBounds,
        lines: layout.lines,
        carets: layout.carets,
        glyphs: layout.glyphs,
        selection: getSelectionRects(layout, { start: 1, end: textValue.length - 1 }),
        decorations,
      })
      expect(layout.glyphs[0]?.fontKey).toBe('latin')
      expect(layout.glyphs.at(-1)?.fontKey).toBe('latin')
      expect(layout.glyphs.slice(1, -1).every((glyph) => glyph.fontKey === 'emoji')).toBe(true)

      const text = new Text({
        layout,
        fonts: renderFonts,
        resources,
        color: 0xffffff,
        styleColors: { emoji: 0x00ff00 },
        outline: { width: fontSize * 0.01, color: 0xff00ff },
        shadow: {
          offsetX: fontSize * 0.01,
          offsetY: -fontSize * 0.01,
          softness: fontSize * 0.01,
          color: 0x000000,
          opacity: 0.5,
        },
      })
      await text.sync()
      expect(text.layoutResult).toBe(layout)
      expect(text.geometry.instanceCount).toBeGreaterThan(layout.glyphs.length)
      const eligibility = [
        ...text.geometry.getAttribute('glyphSdf').array.slice(0, text.geometry.instanceCount * 3),
      ].filter((_, index) => index % 3 === 2)
      expect(eligibility[0]).toBe(1)
      expect(eligibility.at(-1)).toBe(1)
      expect(eligibility.slice(1, -1).every((value) => value === 0)).toBe(true)
      expect({
        blockBounds: layout.blockBounds,
        visibleBounds: layout.visibleBounds,
        lines: layout.lines,
        carets: layout.carets,
        glyphs: layout.glyphs,
        selection: getSelectionRects(layout, { start: 1, end: textValue.length - 1 }),
        decorations: deriveTextDecorations(layout, [
          {
            start: 1,
            end: textValue.length - 1,
            kind: 'underline',
            style: 'wavy',
            color: { red: 255, green: 120, blue: 0, alpha: 255 },
          },
        ]),
      }).toEqual(rendererNeutralState)
      values.push({
        instanceCount: text.geometry.instanceCount,
        bounds: [...text.geometry.getAttribute('glyphBounds').array].slice(
          0,
          text.geometry.instanceCount * 4,
        ),
        slots: [...text.geometry.getAttribute('glyphSlot').array].slice(
          0,
          text.geometry.instanceCount,
        ),
      })
      text.dispose()
    }

    expect(values[1]?.instanceCount).toBe(values[0]?.instanceCount)
    expect(values[1]?.slots).toEqual(values[0]?.slots)
    expect(values[1]?.bounds).not.toEqual(values[0]?.bounds)
    expect(getColorLayers).toHaveBeenCalledTimes(9)
    expect(getOutline.mock.calls.length).toBeGreaterThan(0)
  } finally {
    resources.dispose()
    latin.dispose()
    emoji.dispose()
  }
})

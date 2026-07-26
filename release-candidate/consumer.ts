import { readFile } from 'node:fs/promises'

import { type FontHandle, loadFont } from '@text-rendering-toolkit/font'
import { layoutPreparedText, prepareText } from '@text-rendering-toolkit/layout'
import { generateSdf } from '@text-rendering-toolkit/sdf'
import { Text, TextResources } from '@text-rendering-toolkit/three-webgpu'

const bytes = async (name: string): Promise<Uint8Array> => {
  const value = await readFile(new URL(name, import.meta.url))
  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
}

const latin = await loadFont(await bytes('./NotoSans-wdth-wght.ttf'))
const arabic = await loadFont(await bytes('./NotoSansArabic-wdth-wght.ttf'))
const emoji = await loadFont(await bytes('./noto-validation-colr-v0.ttf'))
const fonts = new Map<string, FontHandle>([
  ['latin', latin],
  ['arabic', arabic],
  ['emoji', emoji],
])

try {
  const prepared = prepareText({
    text: 'Hello مرحبا',
    style: {
      key: 'body',
      fontKeys: ['latin', 'arabic'],
      fontSize: 24,
      language: 'und',
    },
    layout: { maxWidth: 60 },
  })
  if (prepared.schemaVersion !== 2 || prepared.breakOpportunities[0]?.position !== 6) {
    throw new Error('Prepared text did not expose Unicode opportunities')
  }
  if (!prepared.segments.some((segment) => segment.direction === 'rtl')) {
    throw new Error('Prepared text did not retain the right-to-left segment')
  }

  const layout = layoutPreparedText(prepared, fonts)
  if (layout.lines.length !== 2 || layout.lines[0]?.breakAfter !== 'soft') {
    throw new Error('Unicode-aware measured wrapping did not select the expected line')
  }
  const glyph = layout.glyphs[0]
  if (!glyph) throw new Error('Layout did not produce glyphs')
  const font = fonts.get(glyph.fontKey)
  if (!font) throw new Error(`Layout selected an unknown font: ${glyph.fontKey}`)
  const outline = font.getOutline(glyph.glyphId, glyph.variations)
  const padding = Math.max(
    1,
    Math.max(outline.bounds.xMax - outline.bounds.xMin, outline.bounds.yMax - outline.bounds.yMin) /
      8,
  )
  const bitmap = generateSdf({
    outline,
    viewBox: {
      left: outline.bounds.xMin - padding,
      bottom: outline.bounds.yMin - padding,
      right: outline.bounds.xMax + padding,
      top: outline.bounds.yMax + padding,
    },
    width: 16,
    height: 16,
    distance: padding,
    exponent: 9,
  })
  if (bitmap.pixels.length !== 256) throw new Error('SDF generation returned the wrong size')

  const resources = new TextResources({ sdfSize: 32, sdfPadding: 0.31 })
  const text = new Text({
    layout,
    fonts,
    resources,
    outline: { width: 1.5, color: 0x22d3ee, opacity: 0.9 },
    shadow: {
      offsetX: 1,
      offsetY: -1,
      softness: 1,
      color: 0x172554,
      opacity: 0.6,
    },
  })
  const repeated = new Text({ layout, fonts, resources, lit: true })
  try {
    await Promise.all([text.sync(), repeated.sync()])
    if ((text.committedState?.instanceCount ?? 0) === 0) {
      throw new Error('Three.js text did not commit any glyph instances')
    }
    if (repeated.committedState?.instanceCount !== text.committedState?.instanceCount) {
      throw new Error('Shared Three.js text committed inconsistent glyph instances')
    }
    text.outline = { width: 1, color: 0x84cc16 }
    await text.sync()

    const colorPrepared = prepareText({
      text: 'A😀✍🏽🇺🇸B',
      style: {
        key: 'color',
        fontKeys: ['emoji', 'latin'],
        fontSize: 24,
        language: 'und',
      },
    })
    const colorLayout = layoutPreparedText(colorPrepared, fonts)
    const colorText = new Text({
      layout: colorLayout,
      fonts,
      resources,
      styleColors: { color: 0x00ff66 },
    })
    try {
      await colorText.sync()
      if ((colorText.committedState?.instanceCount ?? 0) <= colorLayout.glyphs.length) {
        throw new Error('Packed Three.js path did not expand public COLR v0 layers')
      }
      colorText.styleColors = { color: 0xff00aa }
      await colorText.sync()
    } finally {
      colorText.dispose()
    }
  } finally {
    text.dispose()
    repeated.dispose()
    resources.dispose()
  }
} finally {
  latin.dispose()
  arabic.dispose()
  emoji.dispose()
}

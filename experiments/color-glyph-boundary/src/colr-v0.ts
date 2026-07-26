import type { LayoutResult, PositionedGlyph } from '@text-rendering-toolkit/layout'
import { type TextFont, TextResources } from '@text-rendering-toolkit/three-webgpu'
import { colrV0Layers, cpalPalette } from './sfnt.js'

export interface ColrV0Font {
  readonly font: TextFont
  readonly bytes: Uint8Array
}

export interface ExpandedColrV0Layout {
  readonly layout: LayoutResult
  readonly fonts: ReadonlyMap<string, TextFont>
  readonly styleColors: Readonly<Record<string, number>>
}

interface ResolvedLayer {
  readonly glyphId: number
  readonly color: number
}

function colorInteger(color: { red: number; green: number; blue: number; alpha: number }): number {
  if (color.alpha !== 255) throw new Error('COLR v0 validation only accepts opaque CPAL colors')
  return (color.red << 16) | (color.green << 8) | color.blue
}

function variationKey(variations: Readonly<Record<string, number>>): string {
  return Object.entries(variations)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join(',')
}

export class ColrV0TextResources {
  readonly textResources: TextResources
  readonly #cache = new WeakMap<TextFont, Map<string, readonly ResolvedLayer[] | null>>()
  #resolutionCount = 0
  #disposed = false

  constructor(sdfSize = 64) {
    this.textResources = new TextResources({ sdfSize })
  }

  get resolutionCount(): number {
    return this.#resolutionCount
  }

  expand(
    layout: LayoutResult,
    colorFonts: ReadonlyMap<string, ColrV0Font>,
    paletteIndex = 0,
    foreground = 0xffffff,
  ): ExpandedColrV0Layout {
    if (this.#disposed) throw new Error('COLR v0 resources are disposed')
    const glyphs: PositionedGlyph[] = []
    const styleColors: Record<string, number> = {}
    const glyphOffsets = [0]
    for (const glyph of layout.glyphs) {
      const source = colorFonts.get(glyph.fontKey)
      const layers = source ? this.#resolve(source, glyph, paletteIndex, foreground) : null
      if (!layers?.length) glyphs.push(glyph)
      else {
        for (const [index, layer] of layers.entries()) {
          const styleKey = `__colr0:${glyph.fontKey}:${glyph.glyphId}:${paletteIndex}:${foreground}:${index}`
          styleColors[styleKey] = layer.color
          glyphs.push({ ...glyph, glyphId: layer.glyphId, styleKey })
        }
      }
      glyphOffsets.push(glyphs.length)
    }
    const fonts = new Map<string, TextFont>()
    for (const [fontKey, source] of colorFonts) fonts.set(fontKey, source.font)
    return {
      layout: {
        ...layout,
        glyphs,
        lines: layout.lines.map((line) => ({
          ...line,
          glyphStart: glyphOffsets[line.glyphStart] ?? glyphs.length,
          glyphEnd: glyphOffsets[line.glyphEnd] ?? glyphs.length,
        })),
      },
      fonts,
      styleColors,
    }
  }

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    this.textResources.dispose()
  }

  #resolve(
    source: ColrV0Font,
    glyph: PositionedGlyph,
    paletteIndex: number,
    foreground: number,
  ): readonly ResolvedLayer[] | null {
    let fontCache = this.#cache.get(source.font)
    if (!fontCache) {
      fontCache = new Map()
      this.#cache.set(source.font, fontCache)
    }
    const key = [
      glyph.glyphId,
      variationKey(glyph.variations),
      paletteIndex,
      foreground,
      this.textResources.sdfSize,
    ].join('|')
    if (fontCache.has(key)) return fontCache.get(key) ?? null
    this.#resolutionCount += 1
    const palette = cpalPalette(source.bytes, paletteIndex)
    const layers = colrV0Layers(source.bytes, glyph.glyphId)
    const resolved =
      palette && layers
        ? Object.freeze(
            layers.map((layer) => {
              const color = layer.paletteIndex === 0xffff ? foreground : palette[layer.paletteIndex]
              if (color === undefined) throw new Error('COLR layer references a missing CPAL color')
              return Object.freeze({
                glyphId: layer.glyphId,
                color: typeof color === 'number' ? color : colorInteger(color),
              })
            }),
          )
        : null
    fontCache.set(key, resolved)
    return resolved
  }
}

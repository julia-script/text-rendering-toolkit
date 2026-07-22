import {
  type LayoutResult,
  layoutResolvedText,
  type ResolvedLayoutInput,
  type ResolvedShapedRun,
} from '@webgpu-text/layout'
import type { TextColorGlyphLayer, TextFont, TextGlyphOutline } from '../src/index.js'

export const rectangleOutline: TextGlyphOutline = {
  commands: Uint8Array.from([0, 1, 1, 1, 4]),
  coordinates: Float32Array.from([0, 0, 500, 0, 500, 700, 0, 700]),
  bounds: { xMin: 0, yMin: 0, xMax: 500, yMax: 700 },
}

export const emptyOutline: TextGlyphOutline = {
  commands: new Uint8Array(),
  coordinates: new Float32Array(),
  bounds: { xMin: 0, yMin: 0, xMax: 0, yMax: 0 },
}

export function font(
  options: {
    readonly outline?: TextGlyphOutline
    readonly onOutline?: (glyphId: number) => void
    readonly colorLayers?: readonly TextColorGlyphLayer[] | null
    readonly onColorLayers?: (glyphId: number) => void
  } = {},
): TextFont {
  return {
    getOutline(glyphId) {
      options.onOutline?.(glyphId)
      return options.outline ?? rectangleOutline
    },
    ...(options.colorLayers !== undefined
      ? {
          getColorLayers(glyphId: number) {
            options.onColorLayers?.(glyphId)
            return options.colorLayers ?? null
          },
        }
      : {}),
  }
}

export function resolvedInput(
  text: string,
  options: {
    readonly fontKey?: string
    readonly glyphIds?: readonly number[]
    readonly styleKey?: string
    readonly variations?: Readonly<Record<string, number>>
  } = {},
): ResolvedLayoutInput {
  const fontKey = options.fontKey ?? 'font'
  const styleKey = options.styleKey ?? 'default'
  const glyphIds = options.glyphIds ?? [...text].map((_, index) => index + 1)
  const runs: ResolvedShapedRun[] =
    text.length === 0
      ? []
      : [
          {
            start: 0,
            end: text.length,
            direction: 'ltr',
            bidiLevel: 0,
            script: 'Latn',
            language: 'en',
            styleKey,
            fontKey,
            fontSize: 1,
            fontUnitScale: 0.001,
            metrics: { ascender: 0.8, descender: -0.2, lineGap: 0.1 },
            variations: options.variations ?? {},
            glyphs: [...text].map((character, index) => ({
              start: index,
              end: index + character.length,
              glyphId: glyphIds[index] ?? index + 1,
              xAdvance: 0.6,
              yAdvance: 0,
              xOffset: 0,
              yOffset: 0,
              flags: 0,
              bounds: character === ' ' ? null : { left: 0, bottom: 0, right: 0.5, top: 0.7 },
            })),
          },
        ]
  return {
    text,
    paragraphLevel: 0,
    defaultMetrics: { ascender: 0.8, descender: -0.2, lineGap: 0.1 },
    maxWidth: null,
    whiteSpace: 'normal',
    overflowWrap: 'normal',
    textAlign: 'left',
    textIndent: 0,
    letterSpacing: 0,
    lineHeight: 'normal',
    anchorX: 0,
    anchorY: 0,
    runs,
  }
}

export function resolvedLayout(
  text: string,
  options: Parameters<typeof resolvedInput>[1] = {},
): LayoutResult {
  return layoutResolvedText(resolvedInput(text, options))
}

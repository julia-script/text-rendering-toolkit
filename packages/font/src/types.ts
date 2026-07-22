export type TextDirection = 'ltr' | 'rtl' | 'ttb' | 'btt'

export type VariationCoordinates = Readonly<Record<string, number>>

export interface VariationAxis {
  readonly tag: string
  readonly min: number
  readonly default: number
  readonly max: number
}

export interface FontFacts {
  readonly unitsPerEm: number
  readonly ascender: number
  readonly descender: number
  readonly lineGap: number
  readonly coverageCount: number
  readonly axes: readonly VariationAxis[]
}

export interface ShapeInput {
  readonly text: string
  readonly direction: TextDirection
  readonly script: string
  readonly language: string
  readonly features?: readonly string[]
  readonly variations?: VariationCoordinates
}

export interface ShapedGlyph {
  readonly glyphId: number
  readonly clusterStart: number
  readonly clusterEnd: number
  readonly sourceText: string
  readonly xAdvance: number
  readonly yAdvance: number
  readonly xOffset: number
  readonly yOffset: number
  readonly flags: number
}

export interface ShapedRun {
  readonly glyphs: readonly ShapedGlyph[]
  readonly textLengthUtf16: number
  readonly direction: TextDirection
  readonly script: string
  readonly language: string
  readonly variations: VariationCoordinates
}

export const OutlineCommand = {
  MOVE_TO: 0,
  LINE_TO: 1,
  QUADRATIC_TO: 2,
  CUBIC_TO: 3,
  CLOSE_PATH: 4,
} as const

export type OutlineCommand = (typeof OutlineCommand)[keyof typeof OutlineCommand]

export interface GlyphBounds {
  readonly xMin: number
  readonly yMin: number
  readonly xMax: number
  readonly yMax: number
}

export interface GlyphOutline {
  /** Treat this typed array as readonly. */
  readonly commands: Uint8Array
  /** Treat this typed array as readonly. */
  readonly coordinates: Float32Array
  readonly bounds: GlyphBounds
}

export interface RgbaColor {
  readonly red: number
  readonly green: number
  readonly blue: number
  readonly alpha: number
}

export type ColorGlyphPaint = RgbaColor | 'foreground'

export interface ColorGlyphLayer {
  readonly glyphId: number
  readonly color: ColorGlyphPaint
}

export interface FontHandle {
  readonly facts: FontFacts
  supports(codePoint: number): boolean
  shape(input: ShapeInput): ShapedRun
  getOutline(glyphId: number, variations?: VariationCoordinates): GlyphOutline
  getColorLayers(glyphId: number): readonly ColorGlyphLayer[] | null
  dispose(): void
}

export type FontSource = ArrayBuffer | Uint8Array

import type { LayoutBounds, LayoutResult } from '@webgpu-text/layout'
import type {
  ColorRepresentation,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
} from 'three/webgpu'
import type { TextResources } from './resources.js'

export type TextMaterial = MeshBasicNodeMaterial | MeshStandardNodeMaterial

export interface TextGlyphBounds {
  readonly xMin: number
  readonly yMin: number
  readonly xMax: number
  readonly yMax: number
}

export interface TextGlyphOutline {
  readonly commands: Uint8Array
  readonly coordinates: Float32Array
  readonly bounds: TextGlyphBounds
}

export interface TextRgbaColor {
  readonly red: number
  readonly green: number
  readonly blue: number
  readonly alpha: number
}

export type TextColorGlyphPaint = TextRgbaColor | 'foreground'

export interface TextColorGlyphLayer {
  readonly glyphId: number
  readonly color: TextColorGlyphPaint
}

/** The structural subset of `@webgpu-text/font` used by the renderer. */
export interface TextFont {
  getOutline(glyphId: number, variations?: Readonly<Record<string, number>>): TextGlyphOutline
  getColorLayers?(glyphId: number): readonly TextColorGlyphLayer[] | null
}

export interface TextResourcesOptions {
  readonly sdfSize?: number
}

interface TextOptionsBase {
  readonly layout: LayoutResult
  readonly fonts: ReadonlyMap<string, TextFont>
  readonly lit?: boolean
  readonly color?: ColorRepresentation
  readonly styleColors?: Readonly<Record<string, ColorRepresentation>>
  readonly opacity?: number
  readonly clipRect?: LayoutBounds | null
}

export type TextOptions = TextOptionsBase &
  (
    | { readonly resources: TextResources; readonly sdfSize?: never }
    | { readonly resources?: undefined; readonly sdfSize?: number }
  )

export interface TextCommittedState {
  readonly layoutResult: LayoutResult
  readonly instanceCount: number
}

import type { LayoutBounds, LayoutResult, ResolvedLayoutInput } from '@webgpu-text/layout'
import type { ColorRepresentation } from 'three/webgpu'

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

/** The structural subset of `@webgpu-text/font` used by the renderer. */
export interface TextFont {
  readonly facts: { readonly unitsPerEm: number }
  getOutline(glyphId: number, variations?: Readonly<Record<string, number>>): TextGlyphOutline
}

export interface TextOptions {
  readonly input: ResolvedLayoutInput
  readonly fonts: ReadonlyMap<string, TextFont>
  readonly color?: ColorRepresentation
  readonly styleColors?: Readonly<Record<string, ColorRepresentation>>
  readonly opacity?: number
  readonly clipRect?: LayoutBounds | null
  readonly sdfSize?: number
}

export interface TextCommittedState {
  readonly layoutResult: LayoutResult
  readonly instanceCount: number
}

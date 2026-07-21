export interface AxisInfo {
  readonly min: number
  readonly default: number
  readonly max: number
}

export interface FontExtents {
  readonly ascender: number
  readonly descender: number
  readonly lineGap: number
}

export interface GlyphExtents {
  readonly xBearing: number
  readonly yBearing: number
  readonly width: number
  readonly height: number
}

export interface GlyphInfoAndPosition {
  readonly codepoint: number
  readonly cluster: number
  readonly flags: number
  readonly xAdvance?: number
  readonly yAdvance?: number
  readonly xOffset?: number
  readonly yOffset?: number
}

export class Blob {
  readonly ptr: number
  constructor(data: ArrayBuffer)
}

export class Face {
  readonly ptr: number
  readonly upem: number
  constructor(blob: Blob, index?: number)
  collectUnicodes(): Uint32Array
  getAxisInfos(): Readonly<Record<string, AxisInfo>>
}

export class Font {
  readonly ptr: number
  constructor(face: Face)
  glyphExtents(glyphId: number): GlyphExtents | undefined
  hExtents(): FontExtents
  nominalGlyph(codePoint: number): number | undefined
  setScale(x: number, y: number): void
  setVariations(variations: readonly Variation[]): void
}

export class Buffer {
  readonly ptr: number
  constructor()
  addText(text: string): void
  clearContents(): void
  getGlyphInfosAndPositions(): readonly GlyphInfoAndPosition[]
  setClusterLevel(level: number): void
  setDirection(direction: number): void
  setLanguage(language: string): void
  setScript(script: string): void
}

export class Feature {
  static fromString(value: string): Feature | undefined
}

export class Variation {
  constructor(tag: string, value: number)
}

export function shape(font: Font, buffer: Buffer, features?: readonly Feature[]): void

interface RuntimeModule {
  readonly addFunction: (
    callback: (...args: number[]) => number | void,
    signature: string,
  ) => number
  readonly removeFunction: (pointer: number) => void
}

export function __getRuntime(): {
  readonly Module: RuntimeModule
  readonly exports: Record<string, (...args: number[]) => number>
}

export function __destroyTracked(value: object): void

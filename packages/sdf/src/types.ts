export const SdfCommand = {
  MOVE_TO: 0,
  LINE_TO: 1,
  QUADRATIC_TO: 2,
  CUBIC_TO: 3,
  CLOSE_PATH: 4,
} as const

export type SdfCommand = (typeof SdfCommand)[keyof typeof SdfCommand]

export interface SdfOutline {
  readonly commands: Uint8Array
  readonly coordinates: Float32Array
}

export interface SdfViewBox {
  readonly left: number
  readonly bottom: number
  readonly right: number
  readonly top: number
}

export interface GenerateSdfInput {
  readonly outline: SdfOutline
  readonly viewBox: SdfViewBox
  readonly width: number
  readonly height: number
  readonly distance: number
  readonly exponent: number
}

export interface SdfBitmap {
  readonly pixels: Uint8Array
  readonly width: number
  readonly height: number
  readonly viewBox: SdfViewBox
  readonly distance: number
  readonly exponent: number
}

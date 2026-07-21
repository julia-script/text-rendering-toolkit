export type PreparationErrorCode = 'invalid-input' | 'missing-font' | 'missing-coverage'

export class PreparationError extends TypeError {
  readonly code: PreparationErrorCode
  readonly start: number | undefined
  readonly end: number | undefined
  readonly attemptedFontKeys: readonly string[]

  constructor(
    code: PreparationErrorCode,
    message: string,
    details: {
      readonly start?: number
      readonly end?: number
      readonly attemptedFontKeys?: readonly string[]
    } = {},
  ) {
    super(`Text preparation failed: ${message}`)
    this.name = 'PreparationError'
    this.code = code
    this.start = details.start
    this.end = details.end
    this.attemptedFontKeys = Object.freeze([...(details.attemptedFontKeys ?? [])])
  }
}

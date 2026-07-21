export class InvalidLayoutInputError extends TypeError {
  constructor(message: string) {
    super(`Invalid resolved layout input: ${message}`)
    this.name = 'InvalidLayoutInputError'
  }
}

export type TextPreparationErrorCode = 'invalid-input' | 'missing-font' | 'missing-coverage'

export class TextPreparationError extends TypeError {
  readonly code: TextPreparationErrorCode
  readonly start: number | undefined
  readonly end: number | undefined
  readonly attemptedFontKeys: readonly string[]

  constructor(
    code: TextPreparationErrorCode,
    message: string,
    details: {
      readonly start?: number
      readonly end?: number
      readonly attemptedFontKeys?: readonly string[]
    } = {},
  ) {
    super(`Text preparation failed: ${message}`)
    this.name = 'TextPreparationError'
    this.code = code
    this.start = details.start
    this.end = details.end
    this.attemptedFontKeys = Object.freeze([...(details.attemptedFontKeys ?? [])])
  }
}

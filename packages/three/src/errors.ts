export class InvalidTextInputError extends TypeError {
  override readonly name = 'InvalidTextInputError'
}

export class DisposedTextError extends Error {
  override readonly name = 'DisposedTextError'

  constructor() {
    super('Text has been disposed')
  }
}

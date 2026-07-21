export class InvalidTextInputError extends TypeError {
  override readonly name = 'InvalidTextInputError'
}

export class TextNotSynchronizedError extends Error {
  override readonly name = 'TextNotSynchronizedError'

  constructor() {
    super('Text has no successfully synchronized layout')
  }
}

export class DisposedTextError extends Error {
  override readonly name = 'DisposedTextError'

  constructor() {
    super('Text has been disposed')
  }
}

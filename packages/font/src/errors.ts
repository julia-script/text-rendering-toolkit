export class UnsupportedFontFormatError extends Error {
  constructor(readonly format: 'woff' | 'woff2') {
    super(`${format.toUpperCase()} input is not supported; provide normalized TTF or OTF bytes`)
    this.name = 'UnsupportedFontFormatError'
  }
}

export class InvalidFontError extends Error {
  constructor(message = 'Input is not a usable single-face TTF or OTF font') {
    super(message)
    this.name = 'InvalidFontError'
  }
}

export class InvalidFontInputError extends TypeError {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidFontInputError'
  }
}

export class InvalidShapingInputError extends InvalidFontInputError {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidShapingInputError'
  }
}

export class DisposedFontHandleError extends Error {
  constructor() {
    super('This font handle has been disposed')
    this.name = 'DisposedFontHandleError'
  }
}

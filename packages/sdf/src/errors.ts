export class InvalidSdfInputError extends TypeError {
  constructor(message: string) {
    super(`Invalid SDF input: ${message}`)
    this.name = 'InvalidSdfInputError'
  }
}

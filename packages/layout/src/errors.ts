export class InvalidLayoutInputError extends TypeError {
  constructor(message: string) {
    super(`Invalid resolved layout input: ${message}`)
    this.name = 'InvalidLayoutInputError'
  }
}

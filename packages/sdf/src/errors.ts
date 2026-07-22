/**
 * Thrown by {@link generateSdf} when its input violates the generation
 * contract.
 *
 * @remarks
 * Extends `TypeError`, because every case it reports is a caller mistake rather
 * than bad external data: invalid raster dimensions or allocation size, a
 * zero-area or inverted view box, a non-positive `distance` or `exponent`,
 * wrong typed-array types, or a malformed command and coordinate stream.
 *
 * Always raised *before* the raster is allocated, so an invalid request costs
 * nothing. The message names the specific field or command index at fault.
 */
export class InvalidSdfInputError extends TypeError {
  /**
   * @param message - What was invalid; prefixed with `'Invalid SDF input: '`.
   */
  constructor(message: string) {
    super(`Invalid SDF input: ${message}`)
    this.name = 'InvalidSdfInputError'
  }
}

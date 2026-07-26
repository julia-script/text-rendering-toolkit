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
 *
 * When the input could not even be read — a throwing getter or a `Proxy` trap —
 * the original failure is attached as `cause`.
 */
export class InvalidSdfInputError extends TypeError {
  /**
   * @param message - What was invalid; prefixed with `'Invalid SDF input: '`.
   * @param options - Standard error options; pass `cause` when converting an
   *   underlying failure so the original is not lost.
   */
  constructor(message: string, options?: ErrorOptions) {
    super(`Invalid SDF input: ${message}`, options)
    this.name = 'InvalidSdfInputError'
  }
}

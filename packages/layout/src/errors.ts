/**
 * Thrown by {@link layoutResolvedText} and {@link deriveTextDecorations} when
 * their input violates the resolved-layout contract.
 *
 * @remarks
 * Extends `TypeError`: it reports a caller mistake in constructing resolved
 * input — runs out of order or out of range, a bidi level whose parity
 * contradicts its direction, a non-finite measurement, an inconsistent glyph
 * cluster, or a break opportunity splitting a shaped cluster.
 *
 * Errors from the raw-text path are {@link TextPreparationError} instead, so
 * the two entry points stay distinguishable in a catch.
 */
export class InvalidLayoutInputError extends TypeError {
  /**
   * @param message - What made the input invalid; prefixed with
   *   `'Invalid resolved layout input: '`.
   */
  constructor(message: string) {
    super(`Invalid resolved layout input: ${message}`)
    this.name = 'InvalidLayoutInputError'
  }
}

/**
 * Machine-readable cause of a {@link TextPreparationError}.
 *
 * @remarks
 * `'invalid-input'` is a caller mistake in the text, styles, or policy.
 * `'missing-font'` means a style named a key absent from the registry — a
 * wiring bug. `'missing-coverage'` means every listed font was present but none
 * covered a grapheme, which is a content-and-font-choice problem and the one
 * worth handling at runtime, typically by retrying with a broader fallback.
 * `'font-error'` means a registered {@link FontRegistry} handle itself failed —
 * it was disposed mid-layout, rejected the style's variations or features, or
 * is not a conforming handle; the original error is attached as `cause`.
 */
export type TextPreparationErrorCode =
  | 'invalid-input'
  | 'missing-font'
  | 'missing-coverage'
  | 'font-error'

/**
 * Thrown by {@link prepareText}, {@link layoutPreparedText}, and
 * {@link layoutText} when text cannot be prepared or laid out.
 *
 * @remarks
 * Carries structured detail beyond its message so callers can react
 * programmatically: switch on {@link TextPreparationError.code}, and use the
 * source range and attempted font keys to report exactly which text failed and
 * what was tried.
 *
 * @example
 * Retry with a broader fallback when coverage is the problem.
 * ```typescript
 * try {
 *   return layoutText(input, fonts)
 * } catch (error) {
 *   if (error instanceof TextPreparationError && error.code === 'missing-coverage') {
 *     const missing = input.text.slice(error.start, error.end)
 *     console.warn(`no font covers ${missing}; tried ${error.attemptedFontKeys.join(', ')}`)
 *     return layoutText(withLastResortFont(input), fonts)
 *   }
 *   throw error
 * }
 * ```
 */
export class TextPreparationError extends TypeError {
  /** Machine-readable cause, for branching without parsing the message. */
  readonly code: TextPreparationErrorCode
  /** Inclusive UTF-16 start of the offending source, when one applies. */
  readonly start: number | undefined
  /** Exclusive UTF-16 end of the offending source, when one applies. */
  readonly end: number | undefined
  /** Font keys tried before failing; empty unless font selection was involved. */
  readonly attemptedFontKeys: readonly string[]

  /**
   * @param code - Machine-readable cause.
   * @param message - Human-readable detail; prefixed with
   *   `'Text preparation failed: '`.
   * @param details - Optional source range, attempted font keys, and the
   *   underlying error when a font handle was at fault.
   */
  constructor(
    code: TextPreparationErrorCode,
    message: string,
    details: {
      readonly start?: number
      readonly end?: number
      readonly attemptedFontKeys?: readonly string[]
      readonly cause?: unknown
    } = {},
  ) {
    super(
      `Text preparation failed: ${message}`,
      ...('cause' in details ? [{ cause: details.cause }] : []),
    )
    this.name = 'TextPreparationError'
    this.code = code
    this.start = details.start
    this.end = details.end
    this.attemptedFontKeys = Object.freeze([...(details.attemptedFontKeys ?? [])])
  }
}

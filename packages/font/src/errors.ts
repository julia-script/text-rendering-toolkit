/**
 * Thrown by {@link loadFont} when the input is a web-font container rather than
 * raw SFNT bytes.
 *
 * @remarks
 * This is deliberately distinct from {@link InvalidFontError}: the bytes are a
 * perfectly good font, just wrapped in compression this package does not
 * unwrap. Catching it specifically is the cue to run the bytes through a WOFF
 * decoder and retry, rather than to reject the font outright.
 *
 * @example
 * ```typescript
 * try {
 *   return await loadFont(bytes)
 * } catch (error) {
 *   if (error instanceof UnsupportedFontFormatError) {
 *     return await loadFont(decodeWoff(bytes, error.format))
 *   }
 *   throw error
 * }
 * ```
 */
export class UnsupportedFontFormatError extends Error {
  /**
   * @param format - Which container was detected, from the bytes' signature.
   */
  constructor(readonly format: 'woff' | 'woff2') {
    super(`${format.toUpperCase()} input is not supported; provide normalized TTF or OTF bytes`)
    this.name = 'UnsupportedFontFormatError'
  }
}

/**
 * Thrown when font data is unusable: not an SFNT at all, a font collection,
 * truncated, without character coverage, or with a malformed table this package
 * reads.
 *
 * @remarks
 * This says the *font* is at fault, in contrast to {@link InvalidFontInputError},
 * which says the *call* was. Most instances come from {@link loadFont}, but a
 * font whose COLR or CPAL tables are corrupt only fails later, on the first
 * {@link FontHandle.getColorLayers} call that has to parse them.
 */
export class InvalidFontError extends Error {
  /**
   * @param message - Description of the defect.
   *   @defaultValue `'Input is not a usable single-face TTF or OTF font'`
   */
  constructor(message = 'Input is not a usable single-face TTF or OTF font') {
    super(message)
    this.name = 'InvalidFontError'
  }
}

/**
 * Thrown when an argument is out of contract — a code point that is not a
 * Unicode scalar value, or a glyph ID that is not an unsigned 32-bit integer.
 *
 * @remarks
 * Extends `TypeError`, because it reports a programming mistake at the call
 * site rather than bad data. It is also the base of
 * {@link InvalidShapingInputError}, so catching this type catches both.
 */
export class InvalidFontInputError extends TypeError {
  /**
   * @param message - Which argument violated which constraint.
   */
  constructor(message: string) {
    super(message)
    this.name = 'InvalidFontInputError'
  }
}

/**
 * Thrown by {@link FontHandle.shape} when the {@link ShapeInput} is malformed.
 *
 * @remarks
 * Covers a script that is not four letters, a language that is not a valid tag,
 * an unsupported direction, a feature string HarfBuzz cannot parse, and
 * variation coordinates that are non-finite or name an axis the font does not
 * define. Note that an out-of-range variation *value* is not an error — it is
 * clamped to the axis range — but an unknown axis *tag* is, so a typo surfaces
 * instead of being ignored.
 */
export class InvalidShapingInputError extends InvalidFontInputError {
  /**
   * @param message - Which part of the shaping input was rejected.
   */
  constructor(message: string) {
    super(message)
    this.name = 'InvalidShapingInputError'
  }
}

/**
 * Thrown when any operation is attempted on a {@link FontHandle} after
 * {@link FontHandle.dispose}.
 *
 * @remarks
 * Reaching this error means a handle outlived its disposal in the calling code
 * — usually a cached or captured reference to a font that some other code path
 * already released. `dispose()` itself never throws it; only the other members
 * do.
 */
export class DisposedFontHandleError extends Error {
  constructor() {
    super('This font handle has been disposed')
    this.name = 'DisposedFontHandleError'
  }
}

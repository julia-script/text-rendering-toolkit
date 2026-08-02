/**
 * A break opportunity as a JavaScript UTF-16 offset into the analyzed text.
 *
 * `position` is the offset *before* which a line may be broken, so it is always
 * greater than zero and at most the text length. `required` marks a mandatory
 * break — LB4 and LB5 hard breaks, and the terminal boundary from LB3.
 */
export interface LineBreakOpportunity {
  readonly position: number
  readonly required: boolean
}

/**
 * The carried state the rules need beyond the adjacent character pair.
 *
 * UAX #14 deleted its pair-table section: several rules cannot be decided from
 * two adjacent classes alone. Every such rule reads and writes a field here
 * rather than scanning the text, which keeps analysis single-pass and lets a
 * streaming driver resume mid-text without re-reading what it already consumed.
 */
export interface LineBreakState {
  /**
   * Count of consecutive regional indicators ending at the current position.
   * LB30a breaks only between even-numbered pairs, which no stateless lookup
   * can express.
   */
  regionalIndicatorCount: number

  /**
   * The class before any run of spaces ending at the current position, or
   * `null` when the previous character was not a space.
   *
   * Rules written `X SP* × Y` (LB14, LB15a, LB16, LB17) need the class that
   * preceded the spaces, not the space itself.
   */
  beforeSpaces: number | null

  /**
   * Whether the run of spaces ending at the current position was preceded by an
   * unresolved initial punctuation (LB15a), which suppresses a break after any
   * number of intervening spaces.
   */
  afterInitialPunctuation: boolean

  /**
   * Whether the current position follows `NU (SY | IS)*` — the numeric-sequence
   * prefix LB25 matches.
   *
   * This replaces the backward scan a pair-table implementation needs, and is
   * what allows a streaming driver to discard consumed text.
   */
  inNumericSequence: boolean

  /**
   * Whether a closing bracket has consumed the numeric sequence, for
   * `NU ( SY | IS )* (CL | CP) × (PO | PR)`. The bracket keeps the sequence
   * alive for exactly one more pair.
   */
  numericSequenceClosed: boolean

  /**
   * Whether the previous character was a Hebrew letter followed by a hyphen,
   * for LB21a's `HL (HY | HH) × [^HL]`.
   */
  afterHebrewHyphen: boolean

  /**
   * The class of the most recent character that was not folded away by LB9,
   * or `null` at start of text.
   *
   * LB9 folds `X (CM | ZWJ)*` into `X`, so the rules see the base class while
   * iteration still advances over the marks.
   */
  previousClass: number | null

  /** The code point behind `previousClass`, for rules that consult properties. */
  previousCodePoint: number | null

  /**
   * Whether the character before the folded run was a ZWJ, for LB8a.
   *
   * LB9 treats ZWJ as a combining mark, but LB8a must still suppress a break
   * directly after one, so the distinction is tracked separately.
   */
  afterZeroWidthJoiner: boolean

  /**
   * Whether a break is pending from LB8 (`ZW SP* ÷`), which survives any number
   * of intervening spaces.
   */
  afterZeroWidthSpace: boolean
}

/**
 * The state transitions that must happen *before* a pair is decided, because
 * the rules involved match sequences that include the current character.
 *
 * Shared by the batch and streaming drivers so the two cannot drift apart.
 */
export function enterCarriedState(
  state: LineBreakState,
  cls: number,
  originalClass: number,
  endsWithZeroWidthJoiner: boolean,
  classes: LineBreakClassIds,
): void {
  // `X SP* × Y`: entering a space run records the class before it.
  if (cls === classes.SP) {
    if (state.previousClass !== classes.SP) state.beforeSpaces = state.previousClass
  }

  // LB8a applies to the pair directly after a joiner, folded or standalone.
  state.afterZeroWidthJoiner = endsWithZeroWidthJoiner || originalClass === classes.ZWJ

  // LB25: `NU (SY | IS)*`, optionally closed by one bracket.
  if (cls === classes.NU) {
    state.inNumericSequence = true
    state.numericSequenceClosed = false
  } else if (cls === classes.SY || cls === classes.IS) {
    // Separators extend the sequence unchanged.
  } else if (
    (cls === classes.CL || cls === classes.CP) &&
    state.inNumericSequence &&
    !state.numericSequenceClosed
  ) {
    state.numericSequenceClosed = true
  } else {
    state.inNumericSequence = false
    state.numericSequenceClosed = false
  }

  // LB30a: the even/odd count must include the current character.
  state.regionalIndicatorCount = cls === classes.RI ? state.regionalIndicatorCount + 1 : 0

  // LB21a: the hyphen being decided must itself follow a Hebrew letter.
  state.afterHebrewHyphen =
    (cls === classes.HY || cls === classes.HH) && state.previousClass === classes.HL
}

/**
 * The state transitions that happen *after* a pair is decided.
 *
 * Shared by both drivers for the same reason as {@link enterCarriedState}.
 */
export function exitCarriedState(
  state: LineBreakState,
  cls: number,
  codePoint: number,
  isInitialPunctuation: boolean,
  classes: LineBreakClassIds,
): void {
  if (cls !== classes.SP) state.beforeSpaces = null

  // LB15a: only an initial punctuation in one of the listed contexts suppresses
  // a following break, and the suppression survives intervening spaces.
  if (cls === classes.QU && isInitialPunctuation) {
    const previous = state.previousClass
    state.afterInitialPunctuation =
      previous === null ||
      previous === classes.BK ||
      previous === classes.CR ||
      previous === classes.LF ||
      previous === classes.NL ||
      previous === classes.OP ||
      previous === classes.QU ||
      previous === classes.GL ||
      previous === classes.SP ||
      previous === classes.ZW
  } else if (cls !== classes.SP) {
    state.afterInitialPunctuation = false
  }

  // LB8: a pending break from ZW survives intervening spaces.
  if (cls === classes.ZW) {
    state.afterZeroWidthSpace = true
  } else if (cls !== classes.SP) {
    state.afterZeroWidthSpace = false
  }

  state.previousClass = cls
  state.previousCodePoint = codePoint
}

/** The class identifiers the shared transitions compare against. */
export interface LineBreakClassIds {
  readonly SP: number
  readonly ZWJ: number
  readonly NU: number
  readonly SY: number
  readonly IS: number
  readonly CL: number
  readonly CP: number
  readonly RI: number
  readonly HY: number
  readonly HH: number
  readonly HL: number
  readonly QU: number
  readonly BK: number
  readonly CR: number
  readonly LF: number
  readonly NL: number
  readonly OP: number
  readonly GL: number
  readonly ZW: number
}

/** Creates the start-of-text state. LB2 never breaks at the start of text. */
export function createState(): LineBreakState {
  return {
    regionalIndicatorCount: 0,
    beforeSpaces: null,
    afterInitialPunctuation: false,
    inNumericSequence: false,
    numericSequenceClosed: false,
    afterHebrewHyphen: false,
    previousClass: null,
    previousCodePoint: null,
    afterZeroWidthJoiner: false,
    afterZeroWidthSpace: false,
  }
}

/**
 * The Unicode line breaking algorithm, UAX #14 revision 55 (Unicode 17.0.0).
 *
 * Rules are evaluated in specification order over adjacent positions, with the
 * context that no adjacent pair can carry held in {@link LineBreakState}. The
 * specification's section 7, "Pair Table-Based Implementation", was deleted no
 * later than Unicode 13.0.0; rules like LB30a's even/odd regional-indicator
 * count cannot be expressed as a class-by-class matrix cell, so none is used.
 *
 * Each rule appears in its own function, named for the rule it implements, and
 * returns a {@link Decision}. `Decision.None` means "this rule does not apply,
 * try the next", which is the specification's implicit "otherwise".
 */

import {
  EastAsianWidth,
  GeneralCategory,
  LineBreakClass,
  getEastAsianWidth,
  getGeneralCategory,
  getLineBreakClass,
  isExtendedPictographic,
} from './tables.js'
import type { LineBreakState } from './types.js'

/** U+25CC DOTTED CIRCLE, the `[◌]` class LB28a references. */
const DOTTED_CIRCLE = 0x25cc

export enum Decision {
  /** No break at this position (`×`). */
  Prohibited = 0,
  /** An optional break opportunity (`÷`). */
  Optional = 1,
  /** A mandatory break (`!`). */
  Mandatory = 2,
  /** This rule does not apply; fall through to the next. */
  None = 3,
}

/** One character's resolved properties, as the rules see it. */
export interface Character {
  readonly codePoint: number
  /** Line break class after LB1 resolution. */
  readonly cls: LineBreakClass
  /** The class before LB1 resolution, which LB1 itself needs. */
  readonly originalClass: LineBreakClass
}

/**
 * LB1: assign a line breaking class, resolving the classes the algorithm leaves
 * to the implementation.
 *
 * AI, SG, and XX resolve to AL; SA resolves to CM for combining marks and AL
 * otherwise; CJ resolves to NS. These are the defaults the specification
 * prescribes in the absence of external criteria.
 */
export function resolveCharacter(codePoint: number): Character {
  const originalClass = getLineBreakClass(codePoint)
  let cls = originalClass

  switch (originalClass) {
    case LineBreakClass.AI:
    case LineBreakClass.SG:
    case LineBreakClass.XX:
      cls = LineBreakClass.AL
      break
    case LineBreakClass.SA: {
      const category = getGeneralCategory(codePoint)
      cls =
        category === GeneralCategory.Mn || category === GeneralCategory.Mc
          ? LineBreakClass.CM
          : LineBreakClass.AL
      break
    }
    case LineBreakClass.CJ:
      cls = LineBreakClass.NS
      break
    default:
      break
  }
  return { codePoint, cls, originalClass }
}

/** `$EastAsian`: East_Asian_Width of Fullwidth, Wide, or Halfwidth. */
function isEastAsian(codePoint: number): boolean {
  const width = getEastAsianWidth(codePoint)
  return width === EastAsianWidth.F || width === EastAsianWidth.W || width === EastAsianWidth.H
}

/** `[\p{Pi}&QU]`: an unresolved initial punctuation quotation mark. */
function isInitialPunctuation(character: Character): boolean {
  return (
    character.cls === LineBreakClass.QU &&
    getGeneralCategory(character.codePoint) === GeneralCategory.Pi
  )
}

/** `[\p{Pf}&QU]`: an unresolved final punctuation quotation mark. */
function isFinalPunctuation(character: Character): boolean {
  return (
    character.cls === LineBreakClass.QU &&
    getGeneralCategory(character.codePoint) === GeneralCategory.Pf
  )
}

/** The `(AK | [◌] | AS)` class LB28a repeats. */
function isBrahmicBase(character: Character): boolean {
  return (
    character.cls === LineBreakClass.AK ||
    character.cls === LineBreakClass.AS ||
    character.codePoint === DOTTED_CIRCLE
  )
}

/** Classes that end a line: the hard breaks plus start of text. */
function isHardBreakClass(cls: LineBreakClass): boolean {
  return (
    cls === LineBreakClass.BK ||
    cls === LineBreakClass.CR ||
    cls === LineBreakClass.LF ||
    cls === LineBreakClass.NL
  )
}

/**
 * The tailorable rules, in specification order. Hoisted to module scope: this
 * list is walked once per character, and rebuilding it per call dominated the
 * measured cost.
 */
const RULES = [
  lb4, lb5, lb6, lb7, lb8, lb8a, lb11, lb12, lb12a, lb13, lb14,
  lb15a, lb15b, lb15c, lb15d, lb16, lb17, lb18, lb19, lb19a,
  lb20, lb20a, lb21, lb21a, lb21b, lb22, lb23, lb23a, lb24, lb25,
  lb26, lb27, lb28, lb28a, lb29, lb30, lb30a, lb30b,
] as const

/**
 * Decides whether a break is allowed between `before` and `after`.
 *
 * `before` is null at start of text (LB2) and `after` is null at end of text
 * (LB3). `state` carries the context the pair alone cannot supply and is
 * updated by {@link advanceState} after each decision.
 */
export function decide(
  before: Character | null,
  after: Character | null,
  state: LineBreakState,
): Decision {
  // LB2: never break at the start of text.
  if (before === null) return Decision.Prohibited
  // LB3: always break at the end of text.
  if (after === null) return Decision.Mandatory

  for (const rule of RULES) {
    const decision = rule(before, after, state)
    if (decision !== Decision.None) return decision
  }
  // LB31: break everywhere else.
  return Decision.Optional
}

// --- Mandatory breaks -------------------------------------------------------

/** LB4: `BK !` — always break after hard line breaks. */
function lb4(before: Character): Decision {
  return before.cls === LineBreakClass.BK ? Decision.Mandatory : Decision.None
}

/** LB5: `CR × LF`, `CR !`, `LF !`, `NL !` — CRLF is one break. */
function lb5(before: Character, after: Character): Decision {
  if (before.cls === LineBreakClass.CR && after.cls === LineBreakClass.LF) {
    return Decision.Prohibited
  }
  if (
    before.cls === LineBreakClass.CR ||
    before.cls === LineBreakClass.LF ||
    before.cls === LineBreakClass.NL
  ) {
    return Decision.Mandatory
  }
  return Decision.None
}

/** LB6: `× ( BK | CR | LF | NL )` — do not break before a hard break. */
function lb6(_before: Character, after: Character): Decision {
  return isHardBreakClass(after.cls) ? Decision.Prohibited : Decision.None
}

// --- Spaces and zero width --------------------------------------------------

/** LB7: `× SP`, `× ZW` — do not break before spaces or zero width space. */
function lb7(_before: Character, after: Character): Decision {
  return after.cls === LineBreakClass.SP || after.cls === LineBreakClass.ZW
    ? Decision.Prohibited
    : Decision.None
}

/**
 * LB8: `ZW SP* ÷` — break after a zero width space, through any spaces.
 *
 * The break falls after the ZW and after any spaces following it, so the rule
 * matches when the *preceding* character was a ZW or a space run rooted at one.
 */
function lb8(before: Character, _after: Character, state: LineBreakState): Decision {
  if (before.cls === LineBreakClass.ZW) return Decision.Optional
  if (before.cls === LineBreakClass.SP && state.afterZeroWidthSpace) return Decision.Optional
  return Decision.None
}

/** LB8a: `ZWJ ×` — do not break after a zero width joiner. */
function lb8a(_before: Character, _after: Character, state: LineBreakState): Decision {
  return state.afterZeroWidthJoiner ? Decision.Prohibited : Decision.None
}

/** LB11: `× WJ`, `WJ ×` — do not break around a word joiner. */
function lb11(before: Character, after: Character): Decision {
  return after.cls === LineBreakClass.WJ || before.cls === LineBreakClass.WJ
    ? Decision.Prohibited
    : Decision.None
}

/** LB12: `GL ×` — do not break after a non-breaking space. */
function lb12(before: Character): Decision {
  return before.cls === LineBreakClass.GL ? Decision.Prohibited : Decision.None
}

/** LB12a: `[^SP BA HY HH] × GL` — do not break before a non-breaking space. */
function lb12a(before: Character, after: Character): Decision {
  if (after.cls !== LineBreakClass.GL) return Decision.None
  const excluded =
    before.cls === LineBreakClass.SP ||
    before.cls === LineBreakClass.BA ||
    before.cls === LineBreakClass.HY ||
    before.cls === LineBreakClass.HH
  return excluded ? Decision.None : Decision.Prohibited
}

/** LB13: `× CL`, `× CP`, `× EX`, `× SY` — do not break before these. */
function lb13(_before: Character, after: Character): Decision {
  return after.cls === LineBreakClass.CL ||
    after.cls === LineBreakClass.CP ||
    after.cls === LineBreakClass.EX ||
    after.cls === LineBreakClass.SY
    ? Decision.Prohibited
    : Decision.None
}

/** LB14: `OP SP* ×` — do not break after opening punctuation, through spaces. */
function lb14(before: Character, _after: Character, state: LineBreakState): Decision {
  const effective = before.cls === LineBreakClass.SP ? state.beforeSpaces : before.cls
  return effective === LineBreakClass.OP ? Decision.Prohibited : Decision.None
}

// --- Quotation --------------------------------------------------------------

/**
 * LB15a: `(sot | BK | CR | LF | NL | OP | QU | GL | SP | ZW) [\p{Pi}&QU] SP* ×`
 *
 * Do not break after an unresolved initial punctuation that begins a line or
 * follows a space, opening punctuation, or another quotation mark.
 */
function lb15a(before: Character, _after: Character, state: LineBreakState): Decision {
  // `afterInitialPunctuation` already encodes both the initial-punctuation test
  // and the required preceding context, and survives an intervening space run.
  if (before.cls === LineBreakClass.SP || isInitialPunctuation(before)) {
    return state.afterInitialPunctuation ? Decision.Prohibited : Decision.None
  }
  return Decision.None
}

/**
 * LB15b: `× [\p{Pf}&QU] ( SP | GL | WJ | CL | QU | CP | EX | IS | SY | BK | CR
 * | LF | NL | ZW | eot)`
 *
 * Do not break before an unresolved final punctuation that ends a line or
 * precedes a space or prohibited break. The trailing context is checked by the
 * caller through `nextClass`, since it looks one character beyond the pair.
 */
function lb15b(
  _before: Character,
  after: Character,
  state: LineBreakState & { readonly nextClass?: LineBreakClass | null },
): Decision {
  if (!isFinalPunctuation(after)) return Decision.None

  const next = state.nextClass
  // eot satisfies the trailing context.
  if (next === null || next === undefined) return Decision.Prohibited

  const allowed =
    next === LineBreakClass.SP ||
    next === LineBreakClass.GL ||
    next === LineBreakClass.WJ ||
    next === LineBreakClass.CL ||
    next === LineBreakClass.QU ||
    next === LineBreakClass.CP ||
    next === LineBreakClass.EX ||
    next === LineBreakClass.IS ||
    next === LineBreakClass.SY ||
    next === LineBreakClass.ZW ||
    isHardBreakClass(next)
  return allowed ? Decision.Prohibited : Decision.None
}

/** LB15c: `SP ÷ IS NU` — break before a decimal mark following a space. */
function lb15c(
  before: Character,
  after: Character,
  state: LineBreakState & { readonly nextClass?: LineBreakClass | null },
): Decision {
  if (before.cls !== LineBreakClass.SP || after.cls !== LineBreakClass.IS) {
    return Decision.None
  }
  return state.nextClass === LineBreakClass.NU ? Decision.Optional : Decision.None
}

/** LB15d: `× IS` — otherwise do not break before a separator. */
function lb15d(_before: Character, after: Character): Decision {
  return after.cls === LineBreakClass.IS ? Decision.Prohibited : Decision.None
}

/** LB16: `(CL | CP) SP* × NS` — closing punctuation before a nonstarter. */
function lb16(before: Character, after: Character, state: LineBreakState): Decision {
  if (after.cls !== LineBreakClass.NS) return Decision.None
  const effective = before.cls === LineBreakClass.SP ? state.beforeSpaces : before.cls
  return effective === LineBreakClass.CL || effective === LineBreakClass.CP
    ? Decision.Prohibited
    : Decision.None
}

/** LB17: `B2 SP* × B2` — do not break within an em dash pair. */
function lb17(before: Character, after: Character, state: LineBreakState): Decision {
  if (after.cls !== LineBreakClass.B2) return Decision.None
  const effective = before.cls === LineBreakClass.SP ? state.beforeSpaces : before.cls
  return effective === LineBreakClass.B2 ? Decision.Prohibited : Decision.None
}

/** LB18: `SP ÷` — break after spaces. */
function lb18(before: Character): Decision {
  return before.cls === LineBreakClass.SP ? Decision.Optional : Decision.None
}

/** LB19: `× [ QU - \p{Pi} ]`, `[ QU - \p{Pf} ] ×` — non-initial/final quotes. */
function lb19(before: Character, after: Character): Decision {
  if (after.cls === LineBreakClass.QU && !isInitialPunctuation(after)) {
    return Decision.Prohibited
  }
  if (before.cls === LineBreakClass.QU && !isFinalPunctuation(before)) {
    return Decision.Prohibited
  }
  return Decision.None
}

/**
 * LB19a: quotation marks not surrounded by East Asian characters.
 *
 * `[^$EastAsian] × QU`, `× QU ( [^$EastAsian] | eot )`,
 * `QU × [^$EastAsian]`, `( sot | [^$EastAsian] ) QU ×`
 */
function lb19a(
  before: Character,
  after: Character,
  state: LineBreakState & { readonly nextClass?: LineBreakClass | null; readonly nextCodePoint?: number | null },
): Decision {
  if (after.cls === LineBreakClass.QU) {
    // [^$EastAsian] × QU
    if (!isEastAsian(before.codePoint)) return Decision.Prohibited
    // × QU ( [^$EastAsian] | eot )
    const next = state.nextCodePoint
    if (next === null || next === undefined || !isEastAsian(next)) return Decision.Prohibited
  }
  if (before.cls === LineBreakClass.QU) {
    // QU × [^$EastAsian]
    if (!isEastAsian(after.codePoint)) return Decision.Prohibited
    // ( sot | [^$EastAsian] ) QU ×
    const previous = state.previousCodePoint
    if (previous === null || !isEastAsian(previous)) return Decision.Prohibited
  }
  return Decision.None
}

// --- Hyphens, breaks, and letters -------------------------------------------

/** LB20: `÷ CB`, `CB ÷` — break around unresolved contingent breaks. */
function lb20(before: Character, after: Character): Decision {
  return after.cls === LineBreakClass.CB || before.cls === LineBreakClass.CB
    ? Decision.Optional
    : Decision.None
}

/**
 * LB20a: `( sot | BK | CR | LF | NL | SP | ZW | CB | GL ) ( HY | HH ) × (AL | HL)`
 *
 * Do not break after a word-initial hyphen.
 */
function lb20a(before: Character, after: Character, state: LineBreakState): Decision {
  if (before.cls !== LineBreakClass.HY && before.cls !== LineBreakClass.HH) {
    return Decision.None
  }
  if (after.cls !== LineBreakClass.AL && after.cls !== LineBreakClass.HL) {
    return Decision.None
  }

  const previous = state.previousClass
  if (previous === null) return Decision.Prohibited

  const wordInitial =
    isHardBreakClass(previous) ||
    previous === LineBreakClass.SP ||
    previous === LineBreakClass.ZW ||
    previous === LineBreakClass.CB ||
    previous === LineBreakClass.GL
  return wordInitial ? Decision.Prohibited : Decision.None
}

/** LB21: `× BA`, `× HH`, `× HY`, `× NS`, `BB ×`. */
function lb21(before: Character, after: Character): Decision {
  if (
    after.cls === LineBreakClass.BA ||
    after.cls === LineBreakClass.HH ||
    after.cls === LineBreakClass.HY ||
    after.cls === LineBreakClass.NS
  ) {
    return Decision.Prohibited
  }
  return before.cls === LineBreakClass.BB ? Decision.Prohibited : Decision.None
}

/** LB21a: `HL (HY | HH) × [^HL]` — Hebrew, hyphen, then non-Hebrew. */
function lb21a(before: Character, after: Character, state: LineBreakState): Decision {
  if (!state.afterHebrewHyphen) return Decision.None
  void before
  return after.cls === LineBreakClass.HL ? Decision.None : Decision.Prohibited
}

/** LB21b: `SY × HL` — do not break between solidus and Hebrew. */
function lb21b(before: Character, after: Character): Decision {
  return before.cls === LineBreakClass.SY && after.cls === LineBreakClass.HL
    ? Decision.Prohibited
    : Decision.None
}

/** LB22: `× IN` — do not break before ellipses. */
function lb22(_before: Character, after: Character): Decision {
  return after.cls === LineBreakClass.IN ? Decision.Prohibited : Decision.None
}

// --- Numbers and letters ----------------------------------------------------

/** LB23: `(AL | HL) × NU`, `NU × (AL | HL)`. */
function lb23(before: Character, after: Character): Decision {
  const beforeAlpha = before.cls === LineBreakClass.AL || before.cls === LineBreakClass.HL
  const afterAlpha = after.cls === LineBreakClass.AL || after.cls === LineBreakClass.HL

  if (beforeAlpha && after.cls === LineBreakClass.NU) return Decision.Prohibited
  if (before.cls === LineBreakClass.NU && afterAlpha) return Decision.Prohibited
  return Decision.None
}

/** LB23a: `PR × (ID | EB | EM)`, `(ID | EB | EM) × PO`. */
function lb23a(before: Character, after: Character): Decision {
  const isIdeographic = (cls: LineBreakClass) =>
    cls === LineBreakClass.ID || cls === LineBreakClass.EB || cls === LineBreakClass.EM

  if (before.cls === LineBreakClass.PR && isIdeographic(after.cls)) return Decision.Prohibited
  if (isIdeographic(before.cls) && after.cls === LineBreakClass.PO) return Decision.Prohibited
  return Decision.None
}

/** LB24: `(PR | PO) × (AL | HL)`, `(AL | HL) × (PR | PO)`. */
function lb24(before: Character, after: Character): Decision {
  const isPrefixPostfix = (cls: LineBreakClass) =>
    cls === LineBreakClass.PR || cls === LineBreakClass.PO
  const isAlpha = (cls: LineBreakClass) =>
    cls === LineBreakClass.AL || cls === LineBreakClass.HL

  if (isPrefixPostfix(before.cls) && isAlpha(after.cls)) return Decision.Prohibited
  if (isAlpha(before.cls) && isPrefixPostfix(after.cls)) return Decision.Prohibited
  return Decision.None
}

/**
 * LB25: do not break numbers.
 *
 * The specification writes this as a set of regular expressions over
 * `NU ( SY | IS )*` sequences. `state.inNumericSequence` tracks that prefix
 * going forward, so no rule here scans backward over analyzed text.
 *
 * ```
 * NU ( SY | IS )* CL × PO      NU ( SY | IS )* CP × PO
 * NU ( SY | IS )* CL × PR      NU ( SY | IS )* CP × PR
 * NU ( SY | IS )* × PO         NU ( SY | IS )* × PR
 * PO × OP NU    PO × OP IS NU  PO × NU
 * PR × OP NU    PR × OP IS NU  PR × NU
 * HY × NU       IS × NU        NU ( SY | IS )* × NU
 * ```
 */
function lb25(
  before: Character,
  after: Character,
  state: LineBreakState & {
    readonly nextClass?: LineBreakClass | null
    readonly afterNextClass?: LineBreakClass | null
  },
): Decision {
  const afterIsPrefixPostfix =
    after.cls === LineBreakClass.PO || after.cls === LineBreakClass.PR

  // NU ( SY | IS )* [CL | CP] × (PO | PR), and NU ( SY | IS )* × (PO | PR | NU)
  if (state.inNumericSequence) {
    if (afterIsPrefixPostfix || after.cls === LineBreakClass.NU) {
      return Decision.Prohibited
    }
  }
  // NU ( SY | IS )* (CL | CP) × (PO | PR): the closing bracket is carried by
  // `numericSequenceClosed`, so the digits need not be adjacent.
  if (
    (before.cls === LineBreakClass.CL || before.cls === LineBreakClass.CP) &&
    afterIsPrefixPostfix &&
    state.numericSequenceClosed
  ) {
    return Decision.Prohibited
  }

  // (PO | PR) × NU, and (PO | PR) × OP [IS] NU
  const beforeIsPrefixPostfix =
    before.cls === LineBreakClass.PO || before.cls === LineBreakClass.PR
  if (beforeIsPrefixPostfix) {
    if (after.cls === LineBreakClass.NU) return Decision.Prohibited
    if (after.cls === LineBreakClass.OP) {
      const next = state.nextClass
      if (next === LineBreakClass.NU) return Decision.Prohibited
      if (next === LineBreakClass.IS && state.afterNextClass === LineBreakClass.NU) {
        return Decision.Prohibited
      }
    }
  }

  // HY × NU, IS × NU
  if (
    (before.cls === LineBreakClass.HY || before.cls === LineBreakClass.IS) &&
    after.cls === LineBreakClass.NU
  ) {
    return Decision.Prohibited
  }
  return Decision.None
}

// --- Korean -----------------------------------------------------------------

/** LB26: do not break a Korean syllable. */
function lb26(before: Character, after: Character): Decision {
  if (
    before.cls === LineBreakClass.JL &&
    (after.cls === LineBreakClass.JL ||
      after.cls === LineBreakClass.JV ||
      after.cls === LineBreakClass.H2 ||
      after.cls === LineBreakClass.H3)
  ) {
    return Decision.Prohibited
  }
  if (
    (before.cls === LineBreakClass.JV || before.cls === LineBreakClass.H2) &&
    (after.cls === LineBreakClass.JV || after.cls === LineBreakClass.JT)
  ) {
    return Decision.Prohibited
  }
  if (
    (before.cls === LineBreakClass.JT || before.cls === LineBreakClass.H3) &&
    after.cls === LineBreakClass.JT
  ) {
    return Decision.Prohibited
  }
  return Decision.None
}

/** LB27: treat a Korean syllable block as ID. */
function lb27(before: Character, after: Character): Decision {
  const isJamo = (cls: LineBreakClass) =>
    cls === LineBreakClass.JL ||
    cls === LineBreakClass.JV ||
    cls === LineBreakClass.JT ||
    cls === LineBreakClass.H2 ||
    cls === LineBreakClass.H3

  if (isJamo(before.cls) && after.cls === LineBreakClass.PO) return Decision.Prohibited
  if (before.cls === LineBreakClass.PR && isJamo(after.cls)) return Decision.Prohibited
  return Decision.None
}

// --- Letters, Brahmic, and the remainder ------------------------------------

/** LB28: `(AL | HL) × (AL | HL)` — do not break between alphabetics. */
function lb28(before: Character, after: Character): Decision {
  const isAlpha = (cls: LineBreakClass) =>
    cls === LineBreakClass.AL || cls === LineBreakClass.HL
  return isAlpha(before.cls) && isAlpha(after.cls) ? Decision.Prohibited : Decision.None
}

/**
 * LB28a: do not break inside Brahmic orthographic syllables.
 *
 * ```
 * AP × (AK | [◌] | AS)
 * (AK | [◌] | AS) × (VF | VI)
 * (AK | [◌] | AS) VI × (AK | [◌])
 * (AK | [◌] | AS) × (AK | [◌] | AS) VF
 * ```
 */
function lb28a(
  before: Character,
  after: Character,
  state: LineBreakState & {
    readonly previousCharacter?: Character | null
    readonly nextClass?: LineBreakClass | null
  },
): Decision {
  if (before.cls === LineBreakClass.AP && isBrahmicBase(after)) {
    return Decision.Prohibited
  }
  if (
    isBrahmicBase(before) &&
    (after.cls === LineBreakClass.VF || after.cls === LineBreakClass.VI)
  ) {
    return Decision.Prohibited
  }
  // (AK | [◌] | AS) VI × (AK | [◌])
  if (before.cls === LineBreakClass.VI) {
    const previous = state.previousCharacter
    if (
      previous != null &&
      isBrahmicBase(previous) &&
      (after.cls === LineBreakClass.AK || after.codePoint === DOTTED_CIRCLE)
    ) {
      return Decision.Prohibited
    }
  }
  // (AK | [◌] | AS) × (AK | [◌] | AS) VF
  if (isBrahmicBase(before) && isBrahmicBase(after)) {
    if (state.nextClass === LineBreakClass.VF) return Decision.Prohibited
  }
  return Decision.None
}

/** LB29: `IS × (AL | HL)`. */
function lb29(before: Character, after: Character): Decision {
  if (before.cls !== LineBreakClass.IS) return Decision.None
  return after.cls === LineBreakClass.AL || after.cls === LineBreakClass.HL
    ? Decision.Prohibited
    : Decision.None
}

/** LB30: `(AL | HL | NU) × [OP-$EastAsian]`, `[CP-$EastAsian] × (AL | HL | NU)`. */
function lb30(before: Character, after: Character): Decision {
  const isAlphaNumeric = (cls: LineBreakClass) =>
    cls === LineBreakClass.AL || cls === LineBreakClass.HL || cls === LineBreakClass.NU

  if (
    isAlphaNumeric(before.cls) &&
    after.cls === LineBreakClass.OP &&
    !isEastAsian(after.codePoint)
  ) {
    return Decision.Prohibited
  }
  if (
    before.cls === LineBreakClass.CP &&
    !isEastAsian(before.codePoint) &&
    isAlphaNumeric(after.cls)
  ) {
    return Decision.Prohibited
  }
  return Decision.None
}

/**
 * LB30a: `sot (RI RI)* RI × RI`, `[^RI] (RI RI)* RI × RI`
 *
 * Break between regional indicators only after an even number of them. The
 * even/odd count is the canonical example of state a pair table cannot hold.
 */
function lb30a(before: Character, after: Character, state: LineBreakState): Decision {
  if (before.cls !== LineBreakClass.RI || after.cls !== LineBreakClass.RI) {
    return Decision.None
  }
  return state.regionalIndicatorCount % 2 === 1 ? Decision.Prohibited : Decision.None
}

/** LB30b: `EB × EM`, `[\p{Extended_Pictographic}&\p{Cn}] × EM`. */
function lb30b(before: Character, after: Character): Decision {
  if (after.cls !== LineBreakClass.EM) return Decision.None
  if (before.cls === LineBreakClass.EB) return Decision.Prohibited

  const unassignedPictographic =
    isExtendedPictographic(before.codePoint) &&
    getGeneralCategory(before.codePoint) === GeneralCategory.Cn
  return unassignedPictographic ? Decision.Prohibited : Decision.None
}

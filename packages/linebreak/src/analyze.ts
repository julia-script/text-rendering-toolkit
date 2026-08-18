/**
 * Drives the UAX #14 rules over a string, producing break opportunities as
 * UTF-16 offsets.
 *
 * Iteration is by code point, so a supplementary-plane character advances two
 * UTF-16 units and no offset ever lands inside a surrogate pair. LB9 folding
 * happens here rather than in the rules: combining marks are consumed into
 * their base character so the rules always see base classes, while offsets
 * continue to track the real text.
 */

import type { Character } from './rules.js'
import { Decision, decide, resolveCharacter } from './rules.js'
import { GeneralCategory, getGeneralCategory, LineBreakClass } from './tables.js'
import type { LineBreakOpportunity } from './types.js'
import { createState, enterCarriedState, exitCarriedState } from './types.js'

/** A code point with the UTF-16 offsets it spans. */
interface Position {
  readonly character: Character
  /** Offset of the first UTF-16 unit. */
  readonly start: number
  /** Offset just past the last UTF-16 unit. */
  readonly end: number
}

/**
 * Reads the code points of `text` as positions, resolving each through LB1.
 *
 * Uses explicit surrogate-pair handling rather than a string iterator so the
 * UTF-16 offsets stay exact and lone surrogates are still yielded (LB1 resolves
 * class SG to AL rather than failing).
 */
function* readPositions(text: string): Generator<Position> {
  let offset = 0

  while (offset < text.length) {
    const codePoint = text.codePointAt(offset) as number
    const width = codePoint > 0xffff ? 2 : 1
    yield { character: resolveCharacter(codePoint), start: offset, end: offset + width }
    offset += width
  }
}

/**
 * Folds `X (CM | ZWJ)*` into `X` per LB9, returning the positions with marks
 * attached to their base.
 *
 * LB9 excludes BK, CR, LF, NL, SP, and ZW from acting as a base; a mark after
 * one of those is left standing and LB10 resolves it to AL. The trailing ZWJ
 * flag is kept because LB8a still applies after a folded run.
 */
interface FoldedPosition {
  readonly character: Character
  readonly start: number
  /** Offset just past the base and all marks folded into it. */
  readonly end: number
  /** Whether the folded run ended with a zero width joiner, for LB8a. */
  readonly endsWithZeroWidthJoiner: boolean
}

function foldCombiningMarks(text: string): FoldedPosition[] {
  const positions = [...readPositions(text)]
  const folded: FoldedPosition[] = []

  for (let index = 0; index < positions.length; index += 1) {
    const position = positions[index] as Position
    const cls = position.character.cls

    // LB9 does not apply to these classes; a following mark stands alone.
    const canCarryMarks =
      cls !== LineBreakClass.BK &&
      cls !== LineBreakClass.CR &&
      cls !== LineBreakClass.LF &&
      cls !== LineBreakClass.NL &&
      cls !== LineBreakClass.SP &&
      cls !== LineBreakClass.ZW &&
      cls !== LineBreakClass.CM &&
      cls !== LineBreakClass.ZWJ

    let end = position.end
    let endsWithZeroWidthJoiner = false

    if (canCarryMarks) {
      while (index + 1 < positions.length) {
        const next = positions[index + 1] as Position
        const nextClass = next.character.cls
        if (nextClass !== LineBreakClass.CM && nextClass !== LineBreakClass.ZWJ) break
        endsWithZeroWidthJoiner = nextClass === LineBreakClass.ZWJ
        end = next.end
        index += 1
      }
      folded.push({
        character: position.character,
        start: position.start,
        end,
        endsWithZeroWidthJoiner,
      })
      continue
    }

    // LB10: a remaining CM or ZWJ behaves as AL. ZWJ keeps its identity for LB8a.
    if (cls === LineBreakClass.CM || cls === LineBreakClass.ZWJ) {
      folded.push({
        character: {
          codePoint: 0x0041,
          cls: LineBreakClass.AL,
          originalClass: position.character.originalClass,
        },
        start: position.start,
        end: position.end,
        endsWithZeroWidthJoiner: cls === LineBreakClass.ZWJ,
      })
      continue
    }

    folded.push({
      character: position.character,
      start: position.start,
      end,
      endsWithZeroWidthJoiner,
    })
  }
  return folded
}

/** `[\p{Pi}&QU]` membership, for the LB15a state flag. */
function isInitialPunctuationCodePoint(codePoint: number): boolean {
  return getGeneralCategory(codePoint) === GeneralCategory.Pi
}

/**
 * Produces every break opportunity in `text` as an ordered UTF-16 offset.
 *
 * The terminal boundary is always included and flagged required, per LB3. An
 * empty string produces no opportunities.
 */
export function analyzeLineBreaks(text: string): LineBreakOpportunity[] {
  if (text.length === 0) return []

  const positions = foldCombiningMarks(text)
  const opportunities: LineBreakOpportunity[] = []
  const state = createState()

  for (let index = 0; index < positions.length; index += 1) {
    const current = positions[index] as FoldedPosition
    const next = index + 1 < positions.length ? (positions[index + 1] as FoldedPosition) : null

    enterCarriedState(
      state,
      current.character.cls,
      current.character.originalClass,
      current.endsWithZeroWidthJoiner,
      LineBreakClass,
    )

    // Lookahead the rules need beyond the pair itself. `next` is the character
    // after the break position, so the one after that is index + 2.
    const context = Object.assign(state, {
      nextClass: (positions[index + 2]?.character.cls ?? null) as LineBreakClass | null,
      nextCodePoint: (positions[index + 2]?.character.codePoint ?? null) as number | null,
      afterNextClass: (positions[index + 3]?.character.cls ?? null) as LineBreakClass | null,
      previousCharacter: index > 0 ? (positions[index - 1] as FoldedPosition).character : null,
    })

    const decision = decide(current.character, next === null ? null : next.character, context)

    if (decision === Decision.Optional || decision === Decision.Mandatory) {
      opportunities.push({
        position: current.end,
        required: decision === Decision.Mandatory,
      })
    }
    exitCarriedState(
      state,
      current.character.cls,
      current.character.codePoint,
      isInitialPunctuationCodePoint(current.character.codePoint),
      LineBreakClass,
    )
  }
  return opportunities
}

/** Convenience wrapper returning only the offsets, for the conformance harness. */
export function analyzeOffsets(text: string): number[] {
  return analyzeLineBreaks(text).map((opportunity) => opportunity.position)
}

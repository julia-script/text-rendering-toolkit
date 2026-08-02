/**
 * A streaming driver over the same rule core as batch analysis.
 *
 * Most UAX #14 implementations require the whole string up front. This one does
 * not: because the rules read bounded carried state rather than scanning
 * backward, analysis can stop at the last decidable position, resume when more
 * text arrives, and discard what it has already emitted.
 *
 * Two invariants make that safe:
 *
 * - A decision that needs a character which has not arrived is **withheld**,
 *   not guessed. Some rules look ahead up to three positions, so the driver
 *   keeps that many characters pending until {@link LineBreakStream.end} is
 *   called.
 * - Text before the last emitted opportunity is **released**, because no rule
 *   reads backward. Retained memory is bounded by the current line, not by
 *   total input.
 */

import type { Character } from './rules.js'
import { Decision, decide, resolveCharacter } from './rules.js'
import { GeneralCategory, getGeneralCategory, LineBreakClass } from './tables.js'
import type { LineBreakOpportunity, LineBreakState } from './types.js'
import { createState, enterCarriedState, exitCarriedState } from './types.js'

/**
 * The most positions any rule looks beyond the pair being decided.
 *
 * LB25's `(PO | PR) × OP IS NU` reaches three characters past the break, which
 * is the deepest lookahead in the rule set.
 */
const LOOKAHEAD = 3

interface StreamPosition {
  readonly character: Character
  /** Absolute UTF-16 offset of the first unit, across the whole stream. */
  readonly start: number
  /** Absolute UTF-16 offset just past the base and any folded marks. */
  readonly end: number
  readonly endsWithZeroWidthJoiner: boolean
}

/**
 * Incremental line-break analysis.
 *
 * Feed text with {@link append}, read opportunities from what it returns, and
 * call {@link end} once the input is complete so the terminal boundary (LB3)
 * and any withheld decisions are emitted.
 *
 * Offsets are absolute across the whole stream, so they match what batch
 * analysis of the concatenated text would report.
 */
export class LineBreakStream {
  /** Positions not yet decided, plus the one before them for context. */
  #pending: StreamPosition[] = []
  #state: LineBreakState = createState()
  /** Absolute offset of the next UTF-16 unit to be read. */
  #offset = 0
  /** Trailing text held back because it may continue a combining sequence. */
  #carry = ''
  #ended = false
  /** Count of positions dropped from `#pending`, so indices stay absolute. */
  /** Index into `#pending` of the next position to decide. */
  #cursor = 0

  /**
   * Adds text to the stream and returns every opportunity that is now decidable.
   *
   * A chunk may end mid-sequence, so the tail is retained until enough context
   * arrives; opportunities in that tail appear from a later call.
   */
  append(text: string): LineBreakOpportunity[] {
    if (this.#ended) throw new Error('Cannot append to an ended LineBreakStream')
    if (text.length === 0) return []

    this.#ingest(this.#carry + text, false)
    return this.#drain(false)
  }

  /**
   * Completes the stream, emitting any withheld opportunities and the terminal
   * boundary. Further {@link append} calls throw.
   */
  end(): LineBreakOpportunity[] {
    if (this.#ended) return []

    if (this.#carry.length > 0) {
      this.#ingest(this.#carry, true)
      this.#carry = ''
    }
    this.#ended = true
    return this.#drain(true)
  }

  /**
   * UTF-16 units currently retained.
   *
   * Bounded by the pending lookahead rather than by total input, which is what
   * makes the stream usable for text too large to hold at once.
   */
  get retainedLength(): number {
    return this.#pending.reduce((total, position) => total + (position.end - position.start), 0)
  }

  /**
   * Reads code points into pending positions, folding combining marks per LB9.
   *
   * Unless `final` is set, a trailing character that could still take more
   * combining marks is held in `#carry` so the fold is never split by a chunk
   * boundary.
   */
  #ingest(text: string, final: boolean): void {
    // A chunk may end between the halves of a surrogate pair. Hold the lone
    // high surrogate back rather than decoding it as an unpaired code point;
    // `#pendingCarry` is folded into `#carry` once this pass completes.
    let pendingCarry = ''
    if (!final && text.length > 0) {
      const lastUnit = text.charCodeAt(text.length - 1)
      if (lastUnit >= 0xd800 && lastUnit <= 0xdbff) {
        pendingCarry = text.slice(text.length - 1)
        text = text.slice(0, text.length - 1)
      }
    }

    const raw: { character: Character; start: number; end: number }[] = []
    let cursor = 0

    while (cursor < text.length) {
      const codePoint = text.codePointAt(cursor) as number
      const width = codePoint > 0xffff ? 2 : 1
      raw.push({
        character: resolveCharacter(codePoint),
        start: this.#offset + cursor,
        end: this.#offset + cursor + width,
      })
      cursor += width
    }

    let index = 0
    while (index < raw.length) {
      const base = raw[index] as (typeof raw)[number]
      const cls = base.character.cls

      const canCarryMarks =
        cls !== LineBreakClass.BK &&
        cls !== LineBreakClass.CR &&
        cls !== LineBreakClass.LF &&
        cls !== LineBreakClass.NL &&
        cls !== LineBreakClass.SP &&
        cls !== LineBreakClass.ZW &&
        cls !== LineBreakClass.CM &&
        cls !== LineBreakClass.ZWJ

      let end = base.end
      let endsWithZeroWidthJoiner = false
      let consumed = index

      if (canCarryMarks) {
        while (consumed + 1 < raw.length) {
          const next = raw[consumed + 1] as (typeof raw)[number]
          const nextClass = next.character.cls
          if (nextClass !== LineBreakClass.CM && nextClass !== LineBreakClass.ZWJ) break
          endsWithZeroWidthJoiner = nextClass === LineBreakClass.ZWJ
          end = next.end
          consumed += 1
        }

        // A base that runs to the end of this chunk might still take marks from
        // the next one, so hold it back rather than folding prematurely.
        if (!final && consumed === raw.length - 1) {
          this.#carry = text.slice(base.start - this.#offset) + pendingCarry
          this.#offset = base.start
          return
        }
      }

      if (cls === LineBreakClass.CM || cls === LineBreakClass.ZWJ) {
        this.#pending.push({
          character: {
            codePoint: 0x0041,
            cls: LineBreakClass.AL,
            originalClass: base.character.originalClass,
          },
          start: base.start,
          end: base.end,
          endsWithZeroWidthJoiner: cls === LineBreakClass.ZWJ,
        })
      } else {
        this.#pending.push({
          character: base.character,
          start: base.start,
          end,
          endsWithZeroWidthJoiner,
        })
      }
      index = consumed + 1
    }

    this.#offset = raw[raw.length - 1]?.end ?? this.#offset
    this.#carry = pendingCarry
  }

  /**
   * Decides every pending pair that has enough following context.
   *
   * Without `final`, the last {@link LOOKAHEAD} positions are left pending
   * because a rule may still need a character that has not arrived. Decided
   * positions are dropped, which is what bounds retention.
   */
  #drain(final: boolean): LineBreakOpportunity[] {
    const opportunities: LineBreakOpportunity[] = []

    // Positions before `#cursor` are already decided. Without `final`, stop
    // LOOKAHEAD positions short of the end so no rule is answered from text
    // that has not arrived.
    const limit = final ? this.#pending.length : this.#pending.length - LOOKAHEAD - 1

    while (this.#cursor < limit) {
      const current = this.#pending[this.#cursor] as StreamPosition
      const next = (this.#pending[this.#cursor + 1] ?? null) as StreamPosition | null
      const opportunity = this.#decideAt(this.#cursor, current, next)
      if (opportunity !== null) opportunities.push(opportunity)
      this.#cursor += 1
    }

    // Release decided positions, keeping one as lookbehind for LB28a's
    // `(AK | [◌] | AS) VI × (AK | [◌])`. Retention stays bounded at
    // LOOKAHEAD + 2 positions regardless of total input.
    if (this.#cursor > 1) {
      const drop = this.#cursor - 1
      this.#pending = this.#pending.slice(drop)
      this.#cursor = 1
    }
    return opportunities
  }

  #decideAt(
    index: number,
    current: StreamPosition,
    next: StreamPosition | null,
  ): LineBreakOpportunity | null {
    const state = this.#state

    enterCarriedState(
      state,
      current.character.cls,
      current.character.originalClass,
      current.endsWithZeroWidthJoiner,
      LineBreakClass,
    )

    const context = Object.assign(state, {
      nextClass: (this.#pending[index + 2]?.character.cls ?? null) as LineBreakClass | null,
      nextCodePoint: (this.#pending[index + 2]?.character.codePoint ?? null) as number | null,
      afterNextClass: (this.#pending[index + 3]?.character.cls ?? null) as LineBreakClass | null,
      previousCharacter: (this.#pending[index - 1]?.character ?? null) as Character | null,
    })

    const decision = decide(current.character, next === null ? null : next.character, context)
    const opportunity =
      decision === Decision.Optional || decision === Decision.Mandatory
        ? { position: current.end, required: decision === Decision.Mandatory }
        : null

    this.#advance(current)
    return opportunity
  }

  #advance(current: StreamPosition): void {
    exitCarriedState(
      this.#state,
      current.character.cls,
      current.character.codePoint,
      getGeneralCategory(current.character.codePoint) === GeneralCategory.Pi,
      LineBreakClass,
    )
  }
}

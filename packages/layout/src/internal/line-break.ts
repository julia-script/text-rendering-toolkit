import { findLineBreakOpportunities } from '@text-rendering-toolkit/linebreak'
import type { LineBreakOpportunity } from '../types.js'
import { mandatoryLineBreakBoundaries } from './break-controls.js'

const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' })

function graphemeBoundaries(text: string): ReadonlySet<number> {
  const boundaries = new Set<number>([0, text.length])
  for (const segment of segmenter.segment(text)) boundaries.add(segment.index)
  return boundaries
}

export function lineBreakOpportunities(text: string): readonly LineBreakOpportunity[] {
  const raw: LineBreakOpportunity[] = []
  let previousPosition = -1

  for (const next of findLineBreakOpportunities(text)) {
    if (
      !Number.isInteger(next.position) ||
      next.position < 0 ||
      next.position > text.length ||
      typeof next.required !== 'boolean'
    ) {
      throw new Error('line breaking returned an invalid opportunity')
    }
    if (next.position < previousPosition) {
      throw new Error('line breaking returned non-progressing opportunities')
    }
    if (raw.length > text.length + 1) {
      throw new Error('line breaking returned too many opportunities')
    }
    previousPosition = next.position
    raw.push({ position: next.position, required: next.required })
  }

  const allowed = graphemeBoundaries(text)
  const required = mandatoryLineBreakBoundaries(text)
  const normalized = new Map<number, boolean>()
  for (const opportunity of raw) {
    if (!allowed.has(opportunity.position)) continue
    // UAX #14 rule LB3 reports the end of text as a mandatory break. Layout
    // treats the terminal boundary as required only when a hard break control
    // actually precedes it, so `mandatoryLineBreakBoundaries` below is the sole
    // authority for that position.
    const isRequired = opportunity.position === text.length ? false : opportunity.required
    normalized.set(
      opportunity.position,
      (normalized.get(opportunity.position) ?? false) || isRequired,
    )
  }
  for (const position of required) normalized.set(position, true)
  normalized.set(text.length, (normalized.get(text.length) ?? false) || required.has(text.length))

  return Object.freeze(
    [...normalized]
      .sort(([left], [right]) => left - right)
      .map(([position, isRequired]) => Object.freeze({ position, required: isRequired })),
  )
}

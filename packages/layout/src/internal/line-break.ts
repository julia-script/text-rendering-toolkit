import LineBreaker from 'linebreak'
import type { LineBreakOpportunity } from '../types.js'
import { mandatoryLineBreakBoundaries } from './break-controls.js'

const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' })

function graphemeBoundaries(text: string): ReadonlySet<number> {
  const boundaries = new Set<number>([0, text.length])
  for (const segment of segmenter.segment(text)) boundaries.add(segment.index)
  return boundaries
}

export function lineBreakOpportunities(text: string): readonly LineBreakOpportunity[] {
  const breaker = new LineBreaker(text)
  const raw: LineBreakOpportunity[] = []
  let previousPosition = -1

  for (let next = breaker.nextBreak(); next; next = breaker.nextBreak()) {
    if (
      !Number.isInteger(next.position) ||
      next.position < 0 ||
      next.position > text.length ||
      typeof next.required !== 'boolean'
    ) {
      throw new Error('linebreak returned an invalid opportunity')
    }
    if (next.position < previousPosition) {
      throw new Error('linebreak returned non-progressing opportunities')
    }
    if (raw.length > text.length + 1) {
      throw new Error('linebreak returned too many opportunities')
    }
    previousPosition = next.position
    raw.push({ position: next.position, required: next.required })
  }

  const allowed = graphemeBoundaries(text)
  const required = mandatoryLineBreakBoundaries(text)
  const normalized = new Map<number, boolean>()
  for (const opportunity of raw) {
    if (!allowed.has(opportunity.position)) continue
    normalized.set(
      opportunity.position,
      (normalized.get(opportunity.position) ?? false) || opportunity.required,
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

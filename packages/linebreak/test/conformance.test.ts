import { describe, expect, it } from 'vitest'

import { findLineBreakOpportunities } from '../src/index.js'
import { loadConformanceCases } from './conformance/corpus.js'
import { formatReport, runConformance } from './conformance/report.js'

const analyze = (text: string): number[] =>
  findLineBreakOpportunities(text).map((opportunity) => opportunity.position)

describe('LineBreakTest-17.0.0 conformance', () => {
  it('parses every case in the corpus', () => {
    expect(loadConformanceCases()).toHaveLength(19338)
  })

  it('passes every conformance case', () => {
    const report = runConformance(analyze)
    // The full report names the failing cases and rules, so a regression says
    // which rule broke rather than only how many cases did.
    expect(report.failed, formatReport(report, 10)).toBe(0)
    expect(report.rate).toBe(1)
  })

  it('discriminates: an empty implementation fails every case', () => {
    expect(runConformance(() => []).passed).toBe(0)
  })

  it('discriminates: breaking everywhere fails almost every case', () => {
    const everywhere = runConformance((text) =>
      Array.from({ length: text.length }, (_, index) => index + 1),
    )
    expect(everywhere.rate).toBeLessThan(0.1)
  })
})

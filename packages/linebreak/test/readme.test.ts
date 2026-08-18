import { describe, expect, it } from 'vitest'

import { findLineBreakOpportunities, LineBreakStream, UNICODE_VERSION } from '../src/index.js'

/**
 * Every code example in README.md, executed.
 *
 * Documentation that drifts from behavior is worse than none, and the streaming
 * example is easy to get wrong — the first `append` deliberately returns
 * nothing, which reads like a bug until the lookahead rule is explained.
 */
describe('README examples', () => {
  it('matches the basic usage example', () => {
    expect(findLineBreakOpportunities('Hello world')).toEqual([
      { position: 6, required: false },
      { position: 11, required: true },
    ])
  })

  it('matches the "knows more than spaces" example', () => {
    expect(findLineBreakOpportunities('a-b 1,5').map((o) => o.position)).toEqual([2, 4, 7])
  })

  it('matches the streaming example, including the withheld first result', () => {
    const stream = new LineBreakStream()

    expect(stream.append('Hello ')).toEqual([])
    expect(stream.append('world')).toEqual([{ position: 6, required: false }])
    expect(stream.end()).toEqual([{ position: 11, required: true }])
  })

  it('reports the documented Unicode version', () => {
    expect(UNICODE_VERSION).toBe('17.0.0')
  })
})

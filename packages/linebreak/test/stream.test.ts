import { describe, expect, it } from 'vitest'

import { findLineBreakOpportunities } from '../src/index.js'
import { LineBreakStream } from '../src/stream.js'
import { loadConformanceCases } from './conformance/corpus.js'

const streamPositions = (chunks: readonly string[]): number[] => {
  const stream = new LineBreakStream()
  const positions: number[] = []

  for (const chunk of chunks) {
    positions.push(...stream.append(chunk).map((opportunity) => opportunity.position))
  }
  positions.push(...stream.end().map((opportunity) => opportunity.position))
  return positions
}

const batchPositions = (text: string): number[] =>
  findLineBreakOpportunities(text).map((opportunity) => opportunity.position)

describe('streaming matches batch analysis', () => {
  it('agrees on every corpus case under every two-way split', () => {
    const cases = loadConformanceCases()
    const mismatches: string[] = []

    for (const conformanceCase of cases) {
      const expected = batchPositions(conformanceCase.text)

      for (let split = 0; split <= conformanceCase.text.length; split += 1) {
        const actual = streamPositions([
          conformanceCase.text.slice(0, split),
          conformanceCase.text.slice(split),
        ])
        if (actual.join() !== expected.join()) {
          mismatches.push(
            `line ${conformanceCase.line} split@${split}: ${actual.join()} != ${expected.join()}`,
          )
        }
      }
    }
    expect(mismatches.slice(0, 5)).toEqual([])
  })

  it('agrees when fed one character at a time', () => {
    for (const conformanceCase of loadConformanceCases().slice(0, 2000)) {
      expect(streamPositions([...conformanceCase.text])).toEqual(
        batchPositions(conformanceCase.text),
      )
    }
  })

  it('agrees when a chunk boundary splits a surrogate pair', () => {
    const text = '𝕏a𝕐b'
    // Offset 1 is inside the first surrogate pair.
    expect(streamPositions([text.slice(0, 1), text.slice(1)])).toEqual(batchPositions(text))
  })

  it('agrees when a chunk boundary splits a combining sequence', () => {
    const text = 'é á'
    expect(streamPositions([text.slice(0, 1), text.slice(1)])).toEqual(batchPositions(text))
  })
})

describe('withholding and retention', () => {
  it('withholds a decision that needs a character which has not arrived', () => {
    const stream = new LineBreakStream()
    // `PR × OP IS NU` needs three characters past the break, so no opportunity
    // can be reported from the prefix alone.
    expect(stream.append('$').map((o) => o.position)).toEqual([])
    expect(stream.append('(').map((o) => o.position)).toEqual([])

    const final = [...stream.append('1)'), ...stream.end()]
    expect(final.map((o) => o.position)).toEqual(batchPositions('$(1)'))
  })

  it('keeps retained text bounded regardless of total input', () => {
    const stream = new LineBreakStream()
    const text = 'The quick brown fox jumps over the lazy dog. '.repeat(500)
    let peak = 0

    for (let offset = 0; offset < text.length; offset += 512) {
      stream.append(text.slice(offset, offset + 512))
      peak = Math.max(peak, stream.retainedLength)
    }
    stream.end()

    expect(text.length).toBeGreaterThan(20000)
    expect(peak).toBeLessThan(32)
  })

  it('reports absolute offsets across the whole stream', () => {
    const stream = new LineBreakStream()
    const positions = [...stream.append('hello '), ...stream.append('world'), ...stream.end()].map(
      (opportunity) => opportunity.position,
    )

    expect(positions).toEqual(batchPositions('hello world'))
  })

  it('rejects appending after the stream has ended', () => {
    const stream = new LineBreakStream()
    stream.append('a')
    stream.end()

    expect(() => stream.append('b')).toThrow(/ended/)
  })
})

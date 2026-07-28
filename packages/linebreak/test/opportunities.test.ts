import { describe, expect, it } from 'vitest'

import { UNICODE_VERSION, findLineBreakOpportunities } from '../src/index.js'

const positions = (text: string): number[] =>
  findLineBreakOpportunities(text).map((opportunity) => opportunity.position)

describe('opportunity output', () => {
  it('reports the Unicode version it was generated from', () => {
    expect(UNICODE_VERSION).toBe('17.0.0')
  })

  it('produces no opportunities for empty text', () => {
    expect(findLineBreakOpportunities('')).toEqual([])
  })

  it('always reports the terminal boundary as required', () => {
    const opportunities = findLineBreakOpportunities('hello world')
    const last = opportunities[opportunities.length - 1]

    expect(last?.position).toBe('hello world'.length)
    expect(last?.required).toBe(true)
  })

  it('breaks after a space but not before it', () => {
    expect(positions('a b')).toEqual([2, 3])
  })

  it('returns ordered, unique, in-range offsets', () => {
    const text = 'Hello, world! 123 (foo) "bar" — baz.\nNext line'
    const offsets = positions(text)

    expect(offsets).toEqual([...offsets].sort((a, b) => a - b))
    expect(new Set(offsets).size).toBe(offsets.length)
    for (const offset of offsets) {
      expect(offset).toBeGreaterThan(0)
      expect(offset).toBeLessThanOrEqual(text.length)
    }
  })
})

describe('mandatory breaks', () => {
  it('treats CRLF as a single required break', () => {
    const opportunities = findLineBreakOpportunities('a\r\nb')
    const required = opportunities.filter((opportunity) => opportunity.required)

    expect(required.map((opportunity) => opportunity.position)).toEqual([3, 4])
  })

  it.each([
    ['\n', 'line feed'],
    ['\r', 'carriage return'],
    ['', 'next line'],
    [' ', 'line separator'],
    [' ', 'paragraph separator'],
  ])('treats %s (%s) as a required break', (control) => {
    const opportunities = findLineBreakOpportunities(`a${control}b`)
    const required = opportunities.find((opportunity) => opportunity.position === 2)

    expect(required?.required).toBe(true)
  })
})

describe('surrogate pairs', () => {
  it('never places an offset inside a surrogate pair', () => {
    // Emoji, CJK ideograph, and mathematical letter, all supplementary-plane.
    const text = '👍🏽 中文 𝕏 text'

    for (const offset of positions(text)) {
      if (offset >= text.length) continue
      const unit = text.charCodeAt(offset)
      // A low surrogate at the offset would mean the pair was split.
      expect(unit >= 0xdc00 && unit <= 0xdfff).toBe(false)
    }
  })

  it('counts astral characters as two UTF-16 units', () => {
    const text = '𝕏a'
    expect(text.length).toBe(3)
    expect(positions(text)).toEqual([3])
  })
})

describe('rules that need carried state', () => {
  it('LB30a: keeps a flag pair together but breaks between flags', () => {
    // Four regional indicators: two complete flags.
    const flags = '\u{1F1E7}\u{1F1F7}\u{1F1EF}\u{1F1F5}'
    expect(positions(flags)).toEqual([4, 8])
  })

  it('LB8a: does not break inside a ZWJ emoji sequence', () => {
    const family = '\u{1F468}‍\u{1F469}‍\u{1F467}'
    expect(positions(family)).toEqual([family.length])
  })

  it('LB25: does not break inside a number', () => {
    expect(positions('1,234.56')).toEqual([8])
  })

  it('LB21a: does not break after a hyphen between Hebrew and non-Hebrew', () => {
    expect(positions('ו-M')).toEqual([3])
  })
})

describe('purity', () => {
  it('returns the same result for repeated calls', () => {
    const text = 'The quick brown fox, jumping over 13 lazy dogs.'
    expect(positions(text)).toEqual(positions(text))
  })

  it('returns a fresh array each call', () => {
    const first = findLineBreakOpportunities('a b')
    const second = findLineBreakOpportunities('a b')

    expect(first).not.toBe(second)
    expect(first).toEqual(second)
  })
})

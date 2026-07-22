import { describe, expect, test } from 'vitest'
import { lineBreakOpportunities } from '../src/internal/line-break.js'

describe('Unicode line-break adapter', () => {
  test.each([
    ['empty input', '', [{ position: 0, required: false }]],
    [
      'Latin spaces',
      'hello world',
      [
        { position: 6, required: false },
        { position: 11, required: false },
      ],
    ],
    [
      'CJK characters',
      '你好世界',
      [
        { position: 1, required: false },
        { position: 2, required: false },
        { position: 3, required: false },
        { position: 4, required: false },
      ],
    ],
    ['non-breaking space', 'a\u00a0b', [{ position: 3, required: false }]],
    [
      'zero-width space',
      'a\u200bb',
      [
        { position: 2, required: false },
        { position: 3, required: false },
      ],
    ],
    [
      'emoji ZWJ sequence',
      '👩‍👩‍👧‍👦 x',
      [
        { position: 12, required: false },
        { position: 13, required: false },
      ],
    ],
    [
      'combining sequence',
      'a\u0301 b',
      [
        { position: 3, required: false },
        { position: 4, required: false },
      ],
    ],
    [
      'regional-indicator pairs',
      '🇧🇷🇺🇸 x',
      [
        { position: 4, required: false },
        { position: 9, required: false },
        { position: 10, required: false },
      ],
    ],
    [
      'punctuation',
      'foo/bar,baz',
      [
        { position: 4, required: false },
        { position: 11, required: false },
      ],
    ],
  ])('reports immutable opportunities for %s', (_label, text, expected) => {
    const actual = lineBreakOpportunities(text as string)
    expect(actual).toEqual(expected)
    expect(Object.isFrozen(actual)).toBe(true)
    expect(actual.every(Object.isFrozen)).toBe(true)
  })

  test.each(['\r\n', '\n', '\r', '\u0085', '\u2028', '\u2029'])(
    'normalizes the mandatory break after %j',
    (separator) => {
      expect(lineBreakOpportunities(`a${separator}b`)).toEqual([
        { position: 1 + separator.length, required: true },
        { position: 2 + separator.length, required: false },
      ])
    },
  )

  test.each(['\r\n', '\n', '\r', '\u0085', '\u2028', '\u2029'])(
    'retains a terminal mandatory break after %j exactly once',
    (separator) => {
      expect(lineBreakOpportunities(`a${separator}`)).toEqual([
        { position: 1 + separator.length, required: true },
      ])
    },
  )
})

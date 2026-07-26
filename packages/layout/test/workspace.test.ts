import * as font from '@text-rendering-toolkit/font'
import { expect, test } from 'vitest'

test('resolves the font workspace package', () => {
  expect(font).toBeDefined()
})

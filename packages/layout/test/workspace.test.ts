import * as font from '@webgpu-text/font'
import { expect, test } from 'vitest'

test('resolves the font workspace package', () => {
  expect(font).toBeDefined()
})

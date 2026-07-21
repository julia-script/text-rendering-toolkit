import * as layout from '@webgpu-text/layout'
import * as sdf from '@webgpu-text/sdf'
import { expect, test } from 'vitest'

test('resolves the renderer workspace dependencies', () => {
  expect(layout).toBeDefined()
  expect(sdf).toBeDefined()
})

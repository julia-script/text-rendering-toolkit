import { createHash } from 'node:crypto'
import { describe, expect, test } from 'vitest'

import { atlasFixtureMetadata, createRenderFixture, validateRenderFixture } from '../src/fixture.js'

describe('renderer fixtures', () => {
  test('keeps the committed atlas bytes and typed instance data valid', () => {
    const fixture = createRenderFixture()

    expect(createHash('sha256').update(fixture.atlas.pixels).digest('hex')).toBe(
      atlasFixtureMetadata.sha256,
    )
    expect(fixture.instances.atlasSlots).toEqual(new Uint32Array([0, 1, 2, 3]))
    expect(() => validateRenderFixture(fixture)).not.toThrow()
  })

  test('diagnoses malformed instance lengths', () => {
    const fixture = createRenderFixture()
    fixture.instances.bounds = new Float32Array(3)

    expect(() => validateRenderFixture(fixture)).toThrow(/bounds length/u)
  })

  test('diagnoses invalid bounds and atlas channels', () => {
    const invalidBounds = createRenderFixture()
    invalidBounds.instances.bounds[2] = invalidBounds.instances.bounds[0] ?? 0
    expect(() => validateRenderFixture(invalidBounds)).toThrow(/positive width/u)

    const invalidSlot = createRenderFixture()
    invalidSlot.instances.atlasSlots[0] = 4
    expect(() => validateRenderFixture(invalidSlot)).toThrow(/atlas slot/u)
  })
})

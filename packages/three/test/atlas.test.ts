import type { SdfBitmap } from '@text-rendering-toolkit/sdf'
import { expect, test, vi } from 'vitest'
import { RgbaGlyphAtlas } from '../src/atlas.js'

function bitmap(value: number): SdfBitmap {
  return {
    pixels: new Uint8Array(4).fill(value),
    width: 2,
    height: 2,
    viewBox: { left: -1, bottom: -1, right: 1, top: 1 },
    distance: 1,
    exponent: 9,
  }
}

test('packs four channels, grows to multiple cells, and preserves cached slots', () => {
  const atlas = new RgbaGlyphAtlas(2)
  const plan = atlas.plan(
    Array.from({ length: 12 }, (_, index) => index + 1).map((value) => ({
      key: `${value}`,
      bitmap: bitmap(value),
    })),
  )
  expect(plan.gridSize).toBe(2)
  expect([...plan.glyphs.values()].map((entry) => entry.slot)).toEqual(
    Array.from({ length: 12 }, (_, index) => index),
  )
  expect([...plan.pixels.slice(0, 4)]).toEqual([1, 2, 3, 4])
  expect([...plan.pixels.slice(8, 12)]).toEqual([5, 6, 7, 8])
  atlas.commit(plan)
  expect(atlas.texture.image).toMatchObject({ width: 4, height: 4 })
  expect(atlas.lookup('3')?.slot).toBe(2)

  const cached = atlas.plan([{ key: '3', bitmap: bitmap(99) }])
  expect(cached.dirty).toBe(false)
  expect(cached.glyphs.get('3')?.slot).toBe(2)
  expect(cached.pixels).toEqual(plan.pixels)

  const grown = atlas.plan(
    Array.from({ length: 5 }, (_, index) => index + 13).map((value) => ({
      key: `${value}`,
      bitmap: bitmap(value),
    })),
  )
  expect(grown.gridSize).toBe(4)
  expect(grown.glyphs.get('9')?.slot).toBe(8)
  expect(grown.pixels[16]).toBe(9)
})

test('records empty glyphs without allocating slots and disposes once', () => {
  const atlas = new RgbaGlyphAtlas(2)
  atlas.commit(atlas.plan([{ key: 'empty', bitmap: null }]))
  expect(atlas.lookup('empty')).toEqual({
    slot: null,
    viewBox: null,
    distance: null,
    exponent: null,
  })
  const disposed = vi.fn()
  atlas.texture.addEventListener('dispose', disposed)
  atlas.dispose()
  atlas.dispose()
  expect(disposed).toHaveBeenCalledTimes(1)
  expect(atlas.pixels).toHaveLength(0)
})

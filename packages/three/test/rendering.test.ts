import { expect, test, vi } from 'vitest'
import { RgbaGlyphAtlas } from '../src/atlas.js'
import {
  createGlyphGeometry,
  createGlyphMaterial,
  updateGlyphGeometry,
  updateGlyphMaterial,
} from '../src/rendering.js'

test('updates instanced attributes with capacity growth and explicit bounds', () => {
  const geometry = createGlyphGeometry()
  const originalSlots = geometry.getAttribute('glyphSlot')
  updateGlyphGeometry(
    geometry,
    {
      bounds: Float32Array.from([0, 0, 1, 1, 1, 0, 2, 1, 2, 0, 3, 1]),
      slots: Uint32Array.from([0, 1, 2]),
      colors: Uint8Array.from([255, 0, 0, 0, 255, 0, 0, 0, 255]),
      count: 3,
    },
    { left: 0, bottom: 0, right: 3, top: 1 },
  )
  expect(geometry.instanceCount).toBe(3)
  expect(geometry.getAttribute('glyphSlot')).not.toBe(originalSlots)
  expect([...geometry.getAttribute('glyphSlot').array].slice(0, 3)).toEqual([0, 1, 2])
  expect(geometry.boundingBox?.max.toArray()).toEqual([3, 1, 0])

  const grownSlots = geometry.getAttribute('glyphSlot')
  updateGlyphGeometry(
    geometry,
    {
      bounds: Float32Array.from([4, 0, 5, 1]),
      slots: Uint32Array.from([3]),
      colors: Uint8Array.from([12, 34, 56]),
      count: 1,
    },
    { left: 4, bottom: 0, right: 5, top: 1 },
  )
  expect(geometry.getAttribute('glyphSlot')).toBe(grownSlots)
  expect(geometry.instanceCount).toBe(1)
})

test('updates material controls and disposes owned renderer resources', () => {
  const atlas = new RgbaGlyphAtlas(16)
  const geometry = createGlyphGeometry()
  const { material, controls } = createGlyphMaterial(atlas.texture, atlas.cellSize)
  updateGlyphMaterial(controls, 2, 0.4, { left: -1, bottom: -2, right: 3, top: 4 })
  expect(controls.atlasGrid.value.toArray()).toEqual([2, 2])
  expect(controls.opacity.value).toBe(0.4)
  expect(controls.clipRect.value.toArray()).toEqual([-1, -2, 3, 4])
  const geometryDisposed = vi.fn()
  const materialDisposed = vi.fn()
  geometry.addEventListener('dispose', geometryDisposed)
  material.addEventListener('dispose', materialDisposed)
  geometry.dispose()
  material.dispose()
  atlas.dispose()
  expect(geometryDisposed).toHaveBeenCalledOnce()
  expect(materialDisposed).toHaveBeenCalledOnce()
})

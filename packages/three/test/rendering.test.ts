import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu'
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
  expect(geometry.getAttribute('normal').array).toEqual(
    new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
  )
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

test('creates unlit and planar lit materials from shared controls', () => {
  const atlas = new RgbaGlyphAtlas(16)
  const geometry = createGlyphGeometry()
  const { material, controls } = createGlyphMaterial(atlas.texture)
  const lit = createGlyphMaterial(atlas.texture, true)
  expect(material).toBeInstanceOf(MeshBasicNodeMaterial)
  expect(lit.material).toBeInstanceOf(MeshStandardNodeMaterial)
  expect(lit.material.metalness).toBe(0)
  expect(lit.material.roughness).toBe(0.9)
  expect(lit.material.positionNode).not.toBeNull()
  expect(lit.material.colorNode).not.toBeNull()
  expect(lit.material.opacityNode).not.toBeNull()
  expect(lit.material.maskShadowNode).not.toBeNull()
  expect(lit.material.castShadowNode).toBeNull()
  expect(lit.material.castShadowPositionNode).toBeNull()
  expect(lit.material.shadowSide).toBe(lit.material.side)
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
  lit.material.dispose()
  atlas.dispose()
  expect(geometryDisposed).toHaveBeenCalledOnce()
  expect(materialDisposed).toHaveBeenCalledOnce()
})

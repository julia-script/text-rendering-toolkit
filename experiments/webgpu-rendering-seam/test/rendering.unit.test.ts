import {
  InstancedBufferAttribute,
  LinearFilter,
  NoColorSpace,
  RGBAFormat,
  UnsignedByteType,
} from 'three/webgpu'
import { describe, expect, test } from 'vitest'

import { createRenderFixture } from '../src/fixture.js'
import { assertWebGPUBackend, UnsupportedWebGPUError } from '../src/harness.js'
import { createAtlasTexture, createGlyphGeometry } from '../src/rendering.js'

describe('minimal renderer resources', () => {
  test('maps one unit quad and fixed typed instance attributes', () => {
    const geometry = createGlyphGeometry(createRenderFixture())

    expect(geometry.getAttribute('position').count).toBe(4)
    expect(geometry.index?.count).toBe(6)
    expect(geometry.instanceCount).toBe(4)

    const bounds = geometry.getAttribute('glyphBounds')
    const slots = geometry.getAttribute('glyphSlot')
    const colors = geometry.getAttribute('glyphColor')
    expect(bounds).toBeInstanceOf(InstancedBufferAttribute)
    expect(bounds.array).toBeInstanceOf(Float32Array)
    expect(slots.array).toBeInstanceOf(Uint32Array)
    expect(colors.array).toBeInstanceOf(Uint8Array)
    expect(colors.normalized).toBe(true)

    geometry.dispose()
  })

  test('configures an uncolored, linearly filtered RGBA data texture', () => {
    const fixture = createRenderFixture()
    const texture = createAtlasTexture(fixture)

    expect(texture.image.width).toBe(fixture.atlas.width)
    expect(texture.image.height).toBe(fixture.atlas.height)
    expect(texture.image.data).toBe(fixture.atlas.pixels)
    expect(texture.format).toBe(RGBAFormat)
    expect(texture.type).toBe(UnsignedByteType)
    expect(texture.colorSpace).toBe(NoColorSpace)
    expect(texture.minFilter).toBe(LinearFilter)
    expect(texture.magFilter).toBe(LinearFilter)
    expect(texture.generateMipmaps).toBe(false)

    texture.dispose()
  })

  test('accepts only an explicit WebGPU backend diagnostic', () => {
    expect(() => assertWebGPUBackend({ isWebGPUBackend: true })).not.toThrow()
    expect(() => assertWebGPUBackend({ isWebGPUBackend: false })).toThrow(UnsupportedWebGPUError)
    expect(() => assertWebGPUBackend({})).toThrow(UnsupportedWebGPUError)
  })
})

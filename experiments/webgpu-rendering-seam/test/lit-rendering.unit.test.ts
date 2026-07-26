import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { InstancedBufferAttribute, MeshStandardNodeMaterial } from 'three/webgpu'
import { describe, expect, test } from 'vitest'

import { createRenderFixture } from '../src/fixture.js'
import { createLitGlyphMesh } from '../src/rendering.js'

describe('lit WebGPU rendering seam resources', () => {
  test('adds only planar normals and a standard SDF shadow material', () => {
    const resources = createLitGlyphMesh(createRenderFixture())
    const { geometry, material, mesh } = resources

    expect(geometry.getAttribute('position').count).toBe(4)
    expect(geometry.index?.count).toBe(6)
    expect(geometry.instanceCount).toBe(4)
    expect(geometry.getAttribute('glyphBounds')).toBeInstanceOf(InstancedBufferAttribute)
    expect(geometry.getAttribute('glyphSlot')).toBeInstanceOf(InstancedBufferAttribute)
    expect(geometry.getAttribute('glyphColor')).toBeInstanceOf(InstancedBufferAttribute)
    expect(geometry.getAttribute('normal').array).toEqual(
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    )

    expect(material).toBeInstanceOf(MeshStandardNodeMaterial)
    expect(material.metalness).toBe(0)
    expect(material.roughness).toBe(0.9)
    expect(material.transparent).toBe(true)
    expect(material.depthWrite).toBe(false)
    expect(material.positionNode).not.toBeNull()
    expect(material.colorNode).not.toBeNull()
    expect(material.opacityNode).not.toBeNull()
    expect(material.maskShadowNode).not.toBeNull()
    expect(material.castShadowNode).toBeNull()
    expect(material.castShadowPositionNode).toBeNull()
    expect(material.shadowSide).toBe(material.side)
    expect(mesh.castShadow).toBe(true)
    expect(mesh.receiveShadow).toBe(true)

    resources.dispose()
  })

  test('disposes every owned resource exactly once', () => {
    const resources = createLitGlyphMesh(createRenderFixture())
    const events = { atlas: 0, geometry: 0, material: 0 }
    resources.atlas.addEventListener('dispose', () => {
      events.atlas += 1
    })
    resources.geometry.addEventListener('dispose', () => {
      events.geometry += 1
    })
    resources.material.addEventListener('dispose', () => {
      events.material += 1
    })

    resources.dispose()
    resources.dispose()

    expect(events).toEqual({ atlas: 1, geometry: 1, material: 1 })
  })

  test('uses only the existing public experiment dependencies and Three surfaces', () => {
    const root = new URL('../', import.meta.url)
    const source = readFileSync(new URL('src/rendering.ts', root), 'utf8')
    const packageJson = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')) as {
      dependencies: Record<string, string>
    }

    for (const prohibited of [
      /ShaderMaterial/u,
      /onBeforeCompile/u,
      /WebGL/u,
      /three\/src/u,
      /packages\/three\/src/u,
      /gl_FragColor/u,
      /gl_Position/u,
    ]) {
      expect(source).not.toMatch(prohibited)
    }
    expect(Object.keys(packageJson.dependencies).sort()).toEqual([
      '@text-rendering-toolkit/font',
      '@text-rendering-toolkit/layout',
      '@text-rendering-toolkit/three-webgpu',
      'three',
    ])
    expect(fileURLToPath(root)).toContain('experiments/webgpu-rendering-seam')
  })
})

import { expect, test, vi } from 'vitest'
import { DisposedTextResourcesError, TextResources } from '../src/index.js'
import { commitTextResources, planTextResources, textResourceBinding } from '../src/resources.js'
import { emptyOutline, font, resolvedLayout } from './helpers.js'

test('frames different ink extents with one configurable em padding', () => {
  const resources = new TextResources({ sdfSize: 64, sdfPadding: 0.25 })
  const handle = font()
  handle.getOutline = (glyphId) =>
    glyphId === 1
      ? {
          commands: Uint8Array.from([0, 1]),
          coordinates: Float32Array.from([0, 0, 50, 50]),
          bounds: { xMin: 0, yMin: 0, xMax: 50, yMax: 50 },
        }
      : {
          commands: Uint8Array.from([0, 1]),
          coordinates: Float32Array.from([0, 0, 900, 700]),
          bounds: { xMin: 0, yMin: 0, xMax: 900, yMax: 700 },
        }
  const plan = planTextResources(
    resources,
    resolvedLayout('AB', { glyphIds: [1, 2] }).glyphs,
    new Map([['font', handle]]),
  )
  const cached = plan.glyphs.map(({ key }) => plan.atlas.glyphs.get(key))
  expect(cached.map((glyph) => glyph?.distance)).toEqual([250, 250])
  expect(cached[0]?.viewBox?.right).toBeCloseTo(300)
  expect(cached[1]?.viewBox?.right).toBeCloseTo(1150)
  resources.dispose()
})

test('shares stable texture, slots, dimensions, and glyph work across plans', () => {
  const outline = vi.fn()
  const handle = font({ onOutline: outline })
  const fonts = new Map([['font', handle]])
  const resources = new TextResources({ sdfSize: 16 })
  const binding = textResourceBinding(resources)
  const released = vi.fn()
  binding.texture.addEventListener('dispose', released)
  const first = planTextResources(resources, resolvedLayout('A', { glyphIds: [1] }).glyphs, fonts)
  commitTextResources(resources, first)
  expect(first.atlas.glyphs.get(first.glyphs[0]?.key ?? '')?.slot).toBe(0)
  expect(first.glyphs[0]).toMatchObject({ effectEligible: true })
  expect(first.atlas.glyphs.get(first.glyphs[0]?.key ?? '')).toMatchObject({ exponent: 9 })
  expect(binding.atlasGrid.toArray()).toEqual([1, 1])

  const grown = planTextResources(
    resources,
    resolvedLayout('ABCDE', { glyphIds: [1, 2, 3, 4, 5] }).glyphs,
    fonts,
  )
  commitTextResources(resources, grown)
  expect(grown.glyphs.map(({ key }) => grown.atlas.glyphs.get(key)?.slot)).toEqual([0, 1, 2, 3, 4])
  expect(binding.texture).toBe(textResourceBinding(resources).texture)
  expect(binding.texture.image).toMatchObject({ width: 32, height: 32 })
  expect(binding.atlasGrid.toArray()).toEqual([2, 2])
  expect(released).toHaveBeenCalledOnce()
  expect(outline).toHaveBeenCalledTimes(5)

  const cached = planTextResources(
    resources,
    grown.glyphs.map(({ glyph }) => glyph),
    fonts,
  )
  expect(cached.atlas.dirty).toBe(false)
  expect(outline).toHaveBeenCalledTimes(5)
  resources.dispose()
})

test('caches non-drawing glyphs without slots', () => {
  const outline = vi.fn()
  const handle = font({ outline: emptyOutline, onOutline: outline })
  const resources = new TextResources({ sdfSize: 16 })
  const glyphs = resolvedLayout('AA', { glyphIds: [7, 7] }).glyphs
  const first = planTextResources(resources, glyphs, new Map([['font', handle]]))
  commitTextResources(resources, first)
  expect(first.glyphs).toHaveLength(0)
  expect(first.atlas.glyphs.values().next().value).toEqual({
    slot: null,
    viewBox: null,
    distance: null,
    exponent: null,
  })
  planTextResources(resources, glyphs, new Map([['font', handle]]))
  expect(outline).toHaveBeenCalledOnce()
  resources.dispose()
})

test('validates configuration and disposes its texture exactly once', () => {
  expect(() => new TextResources({ sdfSize: 15 })).toThrow('sdfSize')
  expect(() => new TextResources({ sdfPadding: 0 })).toThrow('sdfPadding')
  const resources = new TextResources({ sdfSize: 16 })
  expect(resources.sdfSize).toBe(16)
  expect(resources.sdfPadding).toBe(0.125)
  const binding = textResourceBinding(resources)
  const disposed = vi.fn()
  binding.texture.addEventListener('dispose', disposed)
  resources.dispose()
  resources.dispose()
  expect(disposed).toHaveBeenCalledOnce()
  expect(() => textResourceBinding(resources)).toThrow(DisposedTextResourcesError)
  expect(() => planTextResources(resources, [], new Map())).toThrow(DisposedTextResourcesError)
})

test('rejects invalid font em facts before planning a drawable glyph', () => {
  const resources = new TextResources({ sdfSize: 16 })
  const invalidFont = { ...font(), facts: { unitsPerEm: 0 } }
  expect(() =>
    planTextResources(resources, resolvedLayout('A').glyphs, new Map([['font', invalidFont]])),
  ).toThrow('facts.unitsPerEm')
  resources.dispose()
})

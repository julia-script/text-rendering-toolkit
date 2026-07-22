import { expect, test, vi } from 'vitest'
import { DisposedTextResourcesError, TextResources } from '../src/index.js'
import { commitTextResources, planTextResources, textResourceBinding } from '../src/resources.js'
import { emptyOutline, font, resolvedLayout } from './helpers.js'

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
  expect(first.atlas.glyphs.values().next().value).toEqual({ slot: null, viewBox: null })
  planTextResources(resources, glyphs, new Map([['font', handle]]))
  expect(outline).toHaveBeenCalledOnce()
  resources.dispose()
})

test('validates configuration and disposes its texture exactly once', () => {
  expect(() => new TextResources({ sdfSize: 15 })).toThrow('sdfSize')
  const resources = new TextResources({ sdfSize: 16 })
  expect(resources.sdfSize).toBe(16)
  const binding = textResourceBinding(resources)
  const disposed = vi.fn()
  binding.texture.addEventListener('dispose', disposed)
  resources.dispose()
  resources.dispose()
  expect(disposed).toHaveBeenCalledOnce()
  expect(() => textResourceBinding(resources)).toThrow(DisposedTextResourcesError)
  expect(() => planTextResources(resources, [], new Map())).toThrow(DisposedTextResourcesError)
})

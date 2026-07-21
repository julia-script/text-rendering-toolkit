import { Mesh, MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu'
import { describe, expect, test, vi } from 'vitest'
import { DisposedTextError, InvalidTextInputError, Text } from '../src/index.js'
import { emptyOutline, font, rectangleOutline, resolvedLayout } from './helpers.js'

describe('public Text lifecycle', () => {
  test('constructs before sync and rejects invalid renderer state atomically', async () => {
    const initial = resolvedLayout('A')
    const text = new Text({ layout: initial, fonts: new Map(), sdfSize: 16 })
    expect(text).toBeInstanceOf(Mesh)
    expect(text.lit).toBe(false)
    expect(text.material).toBeInstanceOf(MeshBasicNodeMaterial)
    expect(text.layoutResult).toBeNull()
    await expect(text.sync()).rejects.toThrow(InvalidTextInputError)
    expect(text.layoutResult).toBeNull()

    const invalid = structuredClone(initial)
    ;(invalid.glyphs[0] as { fontUnitScale: number }).fontUnitScale = 0
    text.layout = invalid
    text.fonts = new Map([['font', font()]])
    await expect(text.sync()).rejects.toThrow('fontUnitScale')
    expect(text.layoutResult).toBeNull()
    text.dispose()
  })

  test('coalesces latest layout, renders styles, and reuses glyphs', async () => {
    const outline = vi.fn()
    const handle = font({ onOutline: outline })
    const text = new Text({
      layout: resolvedLayout('AAA', { glyphIds: [7, 7, 7], styleKey: 'accent' }),
      fonts: new Map([['font', handle]]),
      styleColors: { accent: 0xff0000 },
      opacity: 0.5,
      clipRect: { left: 0, bottom: -1, right: 2, top: 1 },
      sdfSize: 16,
    })
    const latest = resolvedLayout('AA', { glyphIds: [7, 7], styleKey: 'accent' })
    const first = text.sync()
    text.layout = latest
    const second = text.sync()
    expect(second).toBe(first)
    await second
    expect(text.layoutResult).toBe(latest)
    expect(text.geometry.instanceCount).toBe(2)
    expect(outline).toHaveBeenCalledTimes(1)
    expect([...text.geometry.getAttribute('glyphColor').array].slice(0, 3)).toEqual([255, 0, 0])

    await text.sync()
    expect(outline).toHaveBeenCalledTimes(1)
    text.styleColors = { accent: 0x00ff00 }
    text.opacity = 0.25
    text.clipRect = null
    await text.sync()
    expect([...text.geometry.getAttribute('glyphColor').array].slice(0, 3)).toEqual([0, 255, 0])
    text.layout = resolvedLayout('')
    await text.sync()
    expect(text.geometry.instanceCount).toBe(0)
    text.dispose()
  })

  test('preserves committed state after a failed update and recovers', async () => {
    const good = font()
    const text = new Text({
      layout: resolvedLayout('A'),
      fonts: new Map([['font', good]]),
      sdfSize: 16,
    })
    await text.sync()
    const committed = text.layoutResult
    const bounds = [...text.geometry.getAttribute('glyphBounds').array]
    text.fonts = new Map()
    await expect(text.sync()).rejects.toThrow(InvalidTextInputError)
    expect(text.layoutResult).toBe(committed)
    expect([...text.geometry.getAttribute('glyphBounds').array]).toEqual(bounds)
    text.fonts = new Map([['font', good]])
    text.opacity = 0.25
    await text.sync()
    expect(text.layoutResult).toBe(committed)
    text.dispose()
  })

  test('keeps one lit material through updates, recovery, empty layout, and disposal', async () => {
    const handle = font()
    const text = new Text({
      layout: resolvedLayout('A'),
      fonts: new Map([['font', handle]]),
      lit: true,
      sdfSize: 16,
    })
    const material = text.material
    const pending = text.sync()
    text.layout = resolvedLayout('AA')
    expect(text.sync()).toBe(pending)
    await pending
    expect(text.lit).toBe(true)
    expect(text.material).toBeInstanceOf(MeshStandardNodeMaterial)
    expect(text.material).toBe(material)
    expect(text.geometry.instanceCount).toBe(2)

    text.fonts = new Map()
    await expect(text.sync()).rejects.toThrow(InvalidTextInputError)
    expect(text.material).toBe(material)
    expect(text.geometry.instanceCount).toBe(2)

    text.fonts = new Map([['font', handle]])
    text.layout = resolvedLayout('')
    await text.sync()
    expect(text.material).toBe(material)
    expect(text.geometry.instanceCount).toBe(0)

    const disposed = vi.fn()
    material.addEventListener('dispose', disposed)
    text.dispose()
    text.dispose()
    expect(disposed).toHaveBeenCalledOnce()
  })

  test('keeps non-drawing glyphs in layout without render instances', async () => {
    const layout = resolvedLayout('A')
    const text = new Text({
      layout,
      fonts: new Map([['font', font({ outline: emptyOutline })]]),
      sdfSize: 16,
    })
    await text.sync()
    expect(text.layoutResult).toBe(layout)
    expect(text.layoutResult?.glyphs).toHaveLength(1)
    expect(text.geometry.instanceCount).toBe(0)
    text.dispose()
  })

  test('maps zero-width outlines and variation-specific glyphs to padded quads', async () => {
    const outline = vi.fn()
    const handle = font({
      outline: {
        commands: Uint8Array.from([0, 1]),
        coordinates: Float32Array.from([250, 0, 250, 700]),
        bounds: { xMin: 250, yMin: 0, xMax: 250, yMax: 700 },
      },
      onOutline: outline,
    })
    const text = new Text({
      layout: resolvedLayout('A', { glyphIds: [7], variations: { wght: 400 } }),
      fonts: new Map([['font', handle]]),
      sdfSize: 16,
    })
    await text.sync()
    const firstBounds = [...text.geometry.getAttribute('glyphBounds').array].slice(0, 4)
    expect(firstBounds[0]).toBeCloseTo(-0.2167, 3)
    expect(firstBounds[1]).toBeCloseTo(-0.1167, 3)
    expect(firstBounds[2]).toBeCloseTo(0.7167, 3)
    expect(firstBounds[3]).toBeCloseTo(0.8167, 3)
    text.layout = resolvedLayout('A', { glyphIds: [7], variations: { wght: 700 } })
    await text.sync()
    expect(outline).toHaveBeenCalledTimes(2)
    text.dispose()
  })

  test('invalidates pending work, disposes once, and never owns fonts', async () => {
    const outline = vi.fn()
    const handle = font({ onOutline: outline })
    const text = new Text({
      layout: resolvedLayout('A'),
      fonts: new Map([['font', handle]]),
      sdfSize: 16,
    })
    const geometryDisposed = vi.fn()
    const materialDisposed = vi.fn()
    text.geometry.addEventListener('dispose', geometryDisposed)
    text.material.addEventListener('dispose', materialDisposed)
    const pending = text.sync()
    text.dispose()
    text.dispose()
    await expect(pending).rejects.toThrow(DisposedTextError)
    await expect(text.sync()).rejects.toThrow(DisposedTextError)
    expect(geometryDisposed).toHaveBeenCalledOnce()
    expect(materialDisposed).toHaveBeenCalledOnce()

    const replacement = new Text({
      layout: resolvedLayout('A'),
      fonts: new Map([['font', handle]]),
      sdfSize: 16,
    })
    await replacement.sync()
    expect(outline).toHaveBeenCalledOnce()
    expect(handle.getOutline(7)).toBe(rectangleOutline)
    replacement.dispose()
  })
})

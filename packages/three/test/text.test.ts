import { getSelectionRects } from '@webgpu-text/layout'
import { Mesh } from 'three/webgpu'
import { describe, expect, test, vi } from 'vitest'
import {
  DisposedTextError,
  InvalidTextInputError,
  Text,
  TextNotSynchronizedError,
} from '../src/index.js'
import { emptyOutline, font, resolvedInput } from './helpers.js'

describe('public Text lifecycle', () => {
  test('constructs before sync and rejects unavailable font state atomically', async () => {
    const text = new Text({
      input: resolvedInput('A'),
      fonts: new Map(),
      sdfSize: 16,
    })
    expect(text).toBeInstanceOf(Mesh)
    expect(text.layoutResult).toBeNull()
    expect(() => text.getSelectionRects(0, 1)).toThrow(TextNotSynchronizedError)
    await expect(text.sync()).rejects.toThrow(InvalidTextInputError)
    expect(text.layoutResult).toBeNull()

    text.fonts = new Map([['font', font({ unitsPerEm: 0 })]])
    await expect(text.sync()).rejects.toThrow('invalid')
    expect(text.layoutResult).toBeNull()
    text.dispose()
  })

  test('coalesces latest state, renders styles, reuses glyphs, and exposes selection', async () => {
    const outline = vi.fn()
    const handle = font({ onOutline: outline })
    const text = new Text({
      input: resolvedInput('AAA', { glyphIds: [7, 7, 7], styleKey: 'accent' }),
      fonts: new Map([['font', handle]]),
      styleColors: { accent: 0xff0000 },
      opacity: 0.5,
      clipRect: { left: 0, bottom: -1, right: 2, top: 1 },
      sdfSize: 16,
    })
    const first = text.sync()
    text.input = resolvedInput('AA', { glyphIds: [7, 7], styleKey: 'accent' })
    const second = text.sync()
    expect(second).toBe(first)
    await second
    expect(text.layoutResult?.sourceLengthUtf16).toBe(2)
    expect(text.geometry.instanceCount).toBe(2)
    expect(outline).toHaveBeenCalledTimes(1)
    expect([...text.geometry.getAttribute('glyphColor').array].slice(0, 3)).toEqual([255, 0, 0])
    const layout = text.layoutResult
    if (!layout) throw new Error('Expected a committed layout')
    expect(text.getSelectionRects(0, 1)).toEqual(getSelectionRects(layout, { start: 0, end: 1 }))
    expect(text.getSelectionRects(1, 0)).toEqual(getSelectionRects(layout, { start: 1, end: 0 }))
    expect(text.getSelectionRects(1, 1)).toEqual(getSelectionRects(layout, { start: 1, end: 1 }))

    await text.sync()
    expect(outline).toHaveBeenCalledTimes(1)
    text.styleColors = { accent: 0x00ff00 }
    text.opacity = 0.25
    text.clipRect = null
    await text.sync()
    expect([...text.geometry.getAttribute('glyphColor').array].slice(0, 3)).toEqual([0, 255, 0])
    text.input = resolvedInput('')
    await text.sync()
    expect(text.geometry.instanceCount).toBe(0)
    text.dispose()
  })

  test('preserves committed state after a failed update and recovers', async () => {
    const good = font()
    const text = new Text({
      input: resolvedInput('A'),
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
    expect(text.layoutResult?.sourceLengthUtf16).toBe(1)
    text.dispose()
  })

  test('keeps non-drawing glyphs in layout without render instances', async () => {
    const text = new Text({
      input: resolvedInput('A'),
      fonts: new Map([['font', font({ outline: emptyOutline })]]),
      sdfSize: 16,
    })
    await text.sync()
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
      input: resolvedInput('A', { glyphIds: [7], variations: { wght: 400 } }),
      fonts: new Map([['font', handle]]),
      sdfSize: 16,
    })
    await text.sync()
    const firstBounds = [...text.geometry.getAttribute('glyphBounds').array].slice(0, 4)
    expect(firstBounds[0]).toBeCloseTo(-0.2167, 3)
    expect(firstBounds[1]).toBeCloseTo(-0.1167, 3)
    expect(firstBounds[2]).toBeCloseTo(0.7167, 3)
    expect(firstBounds[3]).toBeCloseTo(0.8167, 3)
    text.input = resolvedInput('A', { glyphIds: [7], variations: { wght: 700 } })
    await text.sync()
    expect(outline).toHaveBeenCalledTimes(2)
    text.dispose()
  })

  test('delegates multiline selections from the committed layout', async () => {
    const first = resolvedInput('A').runs[0]
    const second = resolvedInput('B').runs[0]
    if (!first || !second) throw new Error('Expected resolved runs')
    const input = {
      ...resolvedInput(''),
      text: 'A\nB',
      runs: [
        first,
        {
          ...second,
          start: 2,
          end: 3,
          glyphs: second.glyphs.map((glyph) => ({ ...glyph, start: 2, end: 3 })),
        },
      ],
    }
    const text = new Text({ input, fonts: new Map([['font', font()]]), sdfSize: 16 })
    await text.sync()
    const layout = text.layoutResult
    if (!layout) throw new Error('Expected a committed layout')
    expect(text.getSelectionRects(0, 3)).toEqual(getSelectionRects(layout, { start: 0, end: 3 }))
    expect(text.getSelectionRects(0, 3).length).toBeGreaterThan(1)
    text.dispose()
  })

  test('invalidates pending work, disposes once, and never owns fonts', async () => {
    const handle = font()
    const text = new Text({
      input: resolvedInput('A'),
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
    expect(handle.facts.unitsPerEm).toBe(1_000)
    expect(geometryDisposed).toHaveBeenCalledOnce()
    expect(materialDisposed).toHaveBeenCalledOnce()

    const replacement = new Text({
      input: resolvedInput('A'),
      fonts: new Map([['font', handle]]),
      sdfSize: 16,
    })
    await replacement.sync()
    replacement.dispose()
  })
})

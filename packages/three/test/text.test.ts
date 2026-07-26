import { Mesh, MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu'
import { describe, expect, test, vi } from 'vitest'
import {
  DisposedTextError,
  DisposedTextResourcesError,
  InvalidTextInputError,
  Text,
  type TextOptions,
  TextResources,
} from '../src/index.js'
import { textResourceBinding } from '../src/resources.js'
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
    expect([...text.geometry.getAttribute('glyphColor').array].slice(0, 4)).toEqual([
      255, 0, 0, 255,
    ])

    await text.sync()
    expect(outline).toHaveBeenCalledTimes(1)
    text.styleColors = { accent: 0x00ff00 }
    text.opacity = 0.25
    text.clipRect = null
    await text.sync()
    expect([...text.geometry.getAttribute('glyphColor').array].slice(0, 4)).toEqual([
      0, 255, 0, 255,
    ])
    text.layout = resolvedLayout('')
    await text.sync()
    expect(text.geometry.instanceCount).toBe(0)
    text.dispose()
  })

  test('snapshots outline and shadow, expands bounds, reuses resources, and recovers atomically', async () => {
    const getOutline = vi.fn()
    const layout = resolvedLayout('AA', { glyphIds: [7, 7] })
    const outline = { width: 0.03, color: 0xff8800, opacity: 0.75 }
    const shadow = {
      offsetX: 0.02,
      offsetY: -0.02,
      softness: 0.01,
      color: 0x112244,
      opacity: 0.5,
    }
    const text = new Text({
      layout,
      fonts: new Map([['font', font({ onOutline: getOutline })]]),
      outline,
      shadow,
      sdfSize: 64,
    })
    expect(text.outline).toBe(outline)
    expect(text.shadow).toBe(shadow)
    const pending = text.sync()
    outline.width = 1
    await pending

    const texel = (950 * 0.001) / 64
    expect(text.geometry.boundingBox?.min.x).toBeCloseTo(layout.blockBounds.left - 0.03 - texel)
    expect(text.geometry.boundingBox?.min.y).toBeCloseTo(layout.blockBounds.bottom - 0.03 - texel)
    expect(text.geometry.boundingBox?.max.x).toBeCloseTo(layout.blockBounds.right + 0.03 + texel)
    expect(text.geometry.boundingBox?.max.y).toBeCloseTo(layout.blockBounds.top + 0.03 + texel)
    expect([...text.geometry.getAttribute('glyphSdf').array].slice(0, 6)).toEqual([
      expect.closeTo(0.125),
      9,
      1,
      expect.closeTo(0.125),
      9,
      1,
    ])
    expect(getOutline).toHaveBeenCalledOnce()

    text.outline = { width: 0.035, color: 0x00ff00 }
    await text.sync()
    expect(getOutline).toHaveBeenCalledOnce()
    const committed = text.layoutResult
    const acceptedBounds = text.geometry.boundingBox?.clone()

    text.outline = { width: 0.2, color: 0xffffff }
    await expect(text.sync()).rejects.toThrow(/requires .* safely encodable/)
    expect(text.layoutResult).toBe(committed)
    expect(text.geometry.boundingBox).toEqual(acceptedBounds)
    expect(getOutline).toHaveBeenCalledOnce()

    text.outline = { width: 0.02, color: 0xffffff }
    await text.sync()
    expect(text.layoutResult).toBe(committed)
    expect(getOutline).toHaveBeenCalledOnce()
    text.dispose()
  })

  test('rejects paint that falls into the nonlinear eight-bit clamp range', async () => {
    const text = new Text({
      layout: resolvedLayout('A'),
      fonts: new Map([['font', font()]]),
      outline: { width: 0.037, color: 0xffffff },
      sdfSize: 64,
    })
    await text.sync()
    const committed = text.layoutResult
    text.outline = { width: 0.038, color: 0xffffff }
    await expect(text.sync()).rejects.toThrow('safely encodable')
    expect(text.layoutResult).toBe(committed)
    text.dispose()
  })

  test('validates paint records before committing even for empty text', async () => {
    const text = new Text({ layout: resolvedLayout(''), fonts: new Map(), sdfSize: 64 })
    expect(text.outline).toBeNull()
    expect(text.shadow).toBeNull()
    text.outline = { width: -1, color: 0xffffff }
    await expect(text.sync()).rejects.toThrow('outline.width')
    text.outline = null
    text.shadow = { offsetX: 0, offsetY: 0, softness: -1, color: 0 }
    await expect(text.sync()).rejects.toThrow('shadow.softness')
    text.shadow = { offsetX: 0, offsetY: 0, softness: 0, color: 0, opacity: 2 }
    await expect(text.sync()).rejects.toThrow('opacity')
    text.shadow = null
    await text.sync()
    expect(text.geometry.instanceCount).toBe(0)
    text.dispose()
  })

  test('converts layout-unit paint independently for mixed glyph scales', async () => {
    const layout = structuredClone(resolvedLayout('AA', { glyphIds: [7, 7] }))
    ;(layout.glyphs[1] as { fontUnitScale: number }).fontUnitScale = 0.0005
    const getOutline = vi.fn()
    const text = new Text({
      layout,
      fonts: new Map([['font', font({ onOutline: getOutline })]]),
      outline: { width: 0.018, color: 0xff0000 },
      sdfSize: 64,
    })
    await text.sync()
    const sdf = [...text.geometry.getAttribute('glyphSdf').array]
    expect(sdf[0]).toBeCloseTo(0.125)
    expect(sdf[3]).toBeCloseTo(0.0625)
    expect(sdf.slice(1, 3)).toEqual([9, 1])
    expect(sdf.slice(4, 6)).toEqual([9, 1])
    expect(getOutline).toHaveBeenCalledOnce()
    text.dispose()
  })

  test('expands ordered color layers at the base placement with palette and foreground RGBA', async () => {
    const outline = vi.fn()
    const colorLayers = vi.fn()
    const handle = font({
      colorLayers: [
        { glyphId: 10, color: { red: 12, green: 34, blue: 56, alpha: 128 } },
        { glyphId: 11, color: 'foreground' },
      ],
      onOutline: outline,
      onColorLayers: colorLayers,
    })
    const layout = resolvedLayout('A', { glyphIds: [7], styleKey: 'accent' })
    const text = new Text({
      layout,
      fonts: new Map([['font', handle]]),
      styleColors: { accent: 0x00ff00 },
      sdfSize: 16,
    })
    await text.sync()

    expect(text.layoutResult).toBe(layout)
    expect(text.layoutResult?.glyphs).toHaveLength(1)
    expect(text.geometry.instanceCount).toBe(2)
    expect(outline.mock.calls.map(([glyphId]) => glyphId)).toEqual([10, 11])
    expect(colorLayers).toHaveBeenCalledOnce()
    const bounds = [...text.geometry.getAttribute('glyphBounds').array]
    expect(bounds.slice(0, 4)).toEqual(bounds.slice(4, 8))
    expect([...text.geometry.getAttribute('glyphColor').array].slice(0, 8)).toEqual([
      12, 34, 56, 128, 0, 255, 0, 255,
    ])
    expect(
      [...text.geometry.getAttribute('glyphSdf').array].filter((_, index) => index % 3 === 2),
    ).toEqual([0, 0])

    text.styleColors = { accent: 0x0000ff }
    await text.sync()
    expect(outline).toHaveBeenCalledTimes(2)
    expect(colorLayers).toHaveBeenCalledOnce()
    expect([...text.geometry.getAttribute('glyphColor').array].slice(0, 8)).toEqual([
      12, 34, 56, 128, 0, 0, 255, 255,
    ])
    text.dispose()
  })

  test('leaves COLR and blank glyphs ineligible for outline and shadow limits', async () => {
    const layout = resolvedLayout('A', { glyphIds: [7] })
    const color = new Text({
      layout,
      fonts: new Map([
        [
          'font',
          font({
            colorLayers: [
              { glyphId: 10, color: { red: 255, green: 0, blue: 0, alpha: 255 } },
              { glyphId: 11, color: 'foreground' },
            ],
          }),
        ],
      ]),
      outline: { width: 10, color: 0xffffff },
      shadow: { offsetX: 10, offsetY: -10, softness: 10, color: 0 },
      sdfSize: 16,
    })
    await color.sync()
    expect(
      [...color.geometry.getAttribute('glyphSdf').array].filter((_, index) => index % 3 === 2),
    ).toEqual([0, 0])
    expect(color.geometry.boundingBox?.min.toArray()).toEqual([
      layout.blockBounds.left,
      layout.blockBounds.bottom,
      0,
    ])

    const blank = new Text({
      layout,
      fonts: new Map([['font', font({ outline: emptyOutline })]]),
      outline: { width: 10, color: 0xffffff },
      sdfSize: 16,
    })
    await blank.sync()
    expect(blank.geometry.instanceCount).toBe(0)
    color.dispose()
    blank.dispose()
  })

  test('shares layer lookup, outlines, and atlas slots across repeated color glyphs', async () => {
    const outline = vi.fn()
    const colorLayers = vi.fn()
    const handle = font({
      colorLayers: [
        { glyphId: 10, color: { red: 255, green: 0, blue: 0, alpha: 255 } },
        { glyphId: 11, color: { red: 0, green: 0, blue: 255, alpha: 255 } },
      ],
      onOutline: outline,
      onColorLayers: colorLayers,
    })
    const resources = new TextResources({ sdfSize: 16 })
    const fonts = new Map([['font', handle]])
    const first = new Text({
      layout: resolvedLayout('AA', { glyphIds: [7, 7] }),
      fonts,
      resources,
    })
    const second = new Text({ layout: resolvedLayout('A', { glyphIds: [7] }), fonts, resources })
    await first.sync()
    await second.sync()

    expect(colorLayers).toHaveBeenCalledOnce()
    expect(outline.mock.calls.map(([glyphId]) => glyphId)).toEqual([10, 11])
    expect([...first.geometry.getAttribute('glyphSlot').array].slice(0, 4)).toEqual([0, 1, 0, 1])
    expect([...second.geometry.getAttribute('glyphSlot').array].slice(0, 2)).toEqual([0, 1])
    first.dispose()
    second.dispose()
    resources.dispose()
  })

  test('rejects malformed color layers atomically and permits recovery', async () => {
    let malformed = false
    const handle = {
      facts: { unitsPerEm: 1000 },
      getOutline: () => rectangleOutline,
      getColorLayers(glyphId: number) {
        if (glyphId === 2 && malformed) return []
        return null
      },
    }
    const initial = resolvedLayout('A', { glyphIds: [1] })
    const text = new Text({ layout: initial, fonts: new Map([['font', handle]]), sdfSize: 16 })
    await text.sync()
    const priorBounds = [...text.geometry.getAttribute('glyphBounds').array]

    malformed = true
    text.layout = resolvedLayout('B', { glyphIds: [2] })
    await expect(text.sync()).rejects.toThrow('non-empty array or null')
    expect(text.layoutResult).toBe(initial)
    expect([...text.geometry.getAttribute('glyphBounds').array]).toEqual(priorBounds)

    malformed = false
    await text.sync()
    expect(text.layoutResult).toBe(text.layout)
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
    expect(firstBounds[0]).toBeCloseTo(-0.225, 3)
    expect(firstBounds[1]).toBeCloseTo(-0.125, 3)
    expect(firstBounds[2]).toBeCloseTo(0.725, 3)
    expect(firstBounds[3]).toBeCloseTo(0.825, 3)
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

  test('shares glyph work while keeping text state independent', async () => {
    const outline = vi.fn()
    const handle = font({ onOutline: outline })
    const fonts = new Map([['font', handle]])
    const resources = new TextResources({ sdfSize: 16 })
    const firstLayout = resolvedLayout('AA', { glyphIds: [7, 7], styleKey: 'first' })
    const secondLayout = resolvedLayout('A', { glyphIds: [7], styleKey: 'second' })
    const first = new Text({
      layout: firstLayout,
      fonts,
      resources,
      styleColors: { first: 0xff0000 },
    })
    const second = new Text({
      layout: secondLayout,
      fonts,
      resources,
      styleColors: { second: 0x00ff00 },
    })
    await first.sync()
    await second.sync()
    expect(outline).toHaveBeenCalledOnce()
    expect(first.layoutResult).toBe(firstLayout)
    expect(second.layoutResult).toBe(secondLayout)
    expect([...first.geometry.getAttribute('glyphSlot').array].slice(0, 2)).toEqual([0, 0])
    expect([...second.geometry.getAttribute('glyphSlot').array].slice(0, 1)).toEqual([0])
    expect([...first.geometry.getAttribute('glyphColor').array].slice(0, 4)).toEqual([
      255, 0, 0, 255,
    ])
    expect([...second.geometry.getAttribute('glyphColor').array].slice(0, 4)).toEqual([
      0, 255, 0, 255,
    ])
    first.dispose()
    second.dispose()
    resources.dispose()
  })

  test('distinguishes handles and propagates shared growth without resync', async () => {
    const firstOutline = vi.fn()
    const secondOutline = vi.fn()
    const firstHandle = font({ onOutline: firstOutline })
    const secondHandle = font({ onOutline: secondOutline })
    const resources = new TextResources({ sdfSize: 16 })
    const binding = textResourceBinding(resources)
    const first = new Text({
      layout: resolvedLayout('A', { glyphIds: [1] }),
      fonts: new Map([['font', firstHandle]]),
      resources,
    })
    await first.sync()
    const originalLayout = first.layoutResult
    const originalSlot = first.geometry.getAttribute('glyphSlot').getX(0)

    const second = new Text({
      layout: resolvedLayout('ABCDE', { glyphIds: [1, 2, 3, 4, 5] }),
      fonts: new Map([['font', secondHandle]]),
      resources,
    })
    await second.sync()
    expect(firstOutline).toHaveBeenCalledOnce()
    expect(secondOutline).toHaveBeenCalledTimes(5)
    expect(binding.atlasGrid.toArray()).toEqual([2, 2])
    expect(first.layoutResult).toBe(originalLayout)
    expect(first.geometry.getAttribute('glyphSlot').getX(0)).toBe(originalSlot)
    first.dispose()
    second.dispose()
    resources.dispose()
  })

  test('keeps shared plans atomic after outline failure', async () => {
    const calls: number[] = []
    let rejectGlyph = true
    const handle = {
      facts: { unitsPerEm: 1000 },
      getOutline(glyphId: number) {
        calls.push(glyphId)
        if (rejectGlyph && glyphId === 3) throw new Error('broken glyph')
        return rectangleOutline
      },
    }
    const resources = new TextResources({ sdfSize: 16 })
    const committed = new Text({
      layout: resolvedLayout('A', { glyphIds: [1] }),
      fonts: new Map([['font', handle]]),
      resources,
    })
    await committed.sync()
    const failing = new Text({
      layout: resolvedLayout('BC', { glyphIds: [2, 3] }),
      fonts: new Map([['font', handle]]),
      resources,
    })
    await expect(failing.sync()).rejects.toThrow('Unable to resolve outline for glyph 3')
    rejectGlyph = false
    failing.layout = resolvedLayout('B', { glyphIds: [2] })
    await failing.sync()
    expect(calls.filter((glyphId) => glyphId === 2)).toHaveLength(2)
    expect(committed.geometry.getAttribute('glyphSlot').getX(0)).toBe(0)
    expect(failing.geometry.getAttribute('glyphSlot').getX(0)).toBe(1)
    committed.dispose()
    failing.dispose()
    resources.dispose()
  })

  test('separates borrower and shared-resource disposal', async () => {
    const handle = font()
    const resources = new TextResources({ sdfSize: 16 })
    const textureDisposed = vi.fn()
    textResourceBinding(resources).texture.addEventListener('dispose', textureDisposed)
    const first = new Text({
      layout: resolvedLayout('A'),
      fonts: new Map([['font', handle]]),
      resources,
    })
    const second = new Text({
      layout: resolvedLayout('A'),
      fonts: new Map([['font', handle]]),
      resources,
    })
    const pending = first.sync()
    first.dispose()
    await expect(pending).rejects.toThrow(DisposedTextError)
    expect(textureDisposed).not.toHaveBeenCalled()
    await second.sync()
    resources.dispose()
    resources.dispose()
    expect(textureDisposed).toHaveBeenCalledOnce()
    await expect(second.sync()).rejects.toThrow(DisposedTextResourcesError)
    second.dispose()
  })

  test('rejects ambiguous and already-disposed resources', () => {
    const resources = new TextResources({ sdfSize: 16 })
    const base = { layout: resolvedLayout(''), fonts: new Map(), resources }
    expect(() => new Text({ ...base, sdfSize: 16 } as unknown as TextOptions)).toThrow(
      InvalidTextInputError,
    )
    resources.dispose()
    expect(() => new Text(base)).toThrow(DisposedTextResourcesError)
  })

  test('rejects options that are not a usable object before reading any of them', () => {
    const invalid: Array<[string, unknown]> = [
      ['null', null],
      ['undefined', undefined],
      ['number', 16],
      ['string', 'layout'],
      ['missing layout', { fonts: new Map(), sdfSize: 16 }],
      ['missing fonts', { layout: resolvedLayout(''), sdfSize: 16 }],
    ]
    for (const [message, candidate] of invalid) {
      expect(() => new Text(candidate as TextOptions), message).toThrow(InvalidTextInputError)
    }
  })

  test('reports unreadable options as invalid input and keeps the original as cause', () => {
    const boom = new Error('getter exploded')
    const hostile = {
      layout: resolvedLayout(''),
      fonts: new Map(),
      get sdfSize(): number {
        throw boom
      },
    }
    try {
      new Text(hostile as unknown as TextOptions)
      expect.unreachable('expected an InvalidTextInputError')
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidTextInputError)
      expect((error as Error).cause).toBe(boom)
    }
  })
})

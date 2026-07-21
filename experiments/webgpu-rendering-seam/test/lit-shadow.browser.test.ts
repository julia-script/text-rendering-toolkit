import { afterEach, describe, expect, test } from 'vitest'
import { commands, page } from 'vitest/browser'
import { type UnsupportedWebGPUError, VIEWPORT } from '../src/harness.js'
import { createLitShadowHarness, type LitSceneMode } from '../src/lit-harness.js'

const disposeMountedHarnesses: Array<() => void> = []

function pixelAt(image: ImageData, x: number, y: number) {
  const offset = (Math.floor(y) * image.width + Math.floor(x)) * 4
  return [
    image.data[offset] ?? 0,
    image.data[offset + 1] ?? 0,
    image.data[offset + 2] ?? 0,
    image.data[offset + 3] ?? 0,
  ] as const
}

function worldToPixel(x: number, y: number) {
  return {
    x: ((x + 2) / 4) * VIEWPORT.width,
    y: ((1 - y) / 2) * VIEWPORT.height,
  }
}

function sampleWorld(image: ImageData, x: number, y: number, radius = 2) {
  const center = worldToPixel(x, y)
  const sum = [0, 0, 0]
  let count = 0
  for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      const pixel = pixelAt(image, center.x + offsetX, center.y + offsetY)
      sum[0] += pixel[0]
      sum[1] += pixel[1]
      sum[2] += pixel[2]
      count += 1
    }
  }
  return sum.map((value) => value / count) as [number, number, number]
}

function luminance(color: readonly number[]) {
  return (color[0] ?? 0) * 0.2126 + (color[1] ?? 0) * 0.7152 + (color[2] ?? 0) * 0.0722
}

function colorDistance(left: readonly number[], right: readonly number[]) {
  return Math.hypot(
    (left[0] ?? 0) - (right[0] ?? 0),
    (left[1] ?? 0) - (right[1] ?? 0),
    (left[2] ?? 0) - (right[2] ?? 0),
  )
}

function darkerBy(lit: ImageData, shadowed: ImageData, x: number, y: number) {
  return luminance(sampleWorld(lit, x, y)) - luminance(sampleWorld(shadowed, x, y))
}

async function createMountedHarness() {
  await page.viewport(VIEWPORT.width + 28, VIEWPORT.height + 28)
  const container = document.createElement('div')
  document.body.style.margin = '0'
  document.body.replaceChildren(container)
  const harness = await createLitShadowHarness(container)
  disposeMountedHarnesses.push(harness.dispose)
  return harness
}

async function captureMode(
  harness: Awaited<ReturnType<typeof createLitShadowHarness>>,
  mode: LitSceneMode,
) {
  harness.setMode(mode)
  await harness.render()
  await harness.render()
  return harness.capturePixels()
}

afterEach(() => {
  for (const dispose of disposeMountedHarnesses.splice(0)) dispose()
  document.body.replaceChildren()
})

describe('actual WebGPU lit text and shadow seam', () => {
  test('lights SDF glyphs and casts and receives glyph-shaped shadows', async () => {
    const harness = await createMountedHarness()
    const ambient = await captureMode(harness, 'ambient')
    const lit = await captureMode(harness, 'lit')
    const cast = await captureMode(harness, 'cast')
    const receive = await captureMode(harness, 'receive')
    const shadowed = await captureMode(harness, 'shadow')

    const rectangle = sampleWorld(lit, -1.325, 0.5)
    const diagonal = sampleWorld(lit, -0.425, 0.5)
    const circle = sampleWorld(lit, 0.475, 0.5)
    const stem = sampleWorld(lit, 1.375, 0.5)
    const receiver = sampleWorld(lit, -1.9, -0.8)

    const lightGain = luminance(rectangle) - luminance(sampleWorld(ambient, -1.325, 0.5))
    expect(lightGain).toBeGreaterThan(12)
    expect(rectangle[0]).toBeGreaterThan(rectangle[1] + 20)
    expect(diagonal[1]).toBeGreaterThan(diagonal[0] + 20)
    expect(circle[2]).toBeGreaterThan(circle[0] + 20)
    expect(stem[0]).toBeGreaterThan(stem[2] + 20)
    expect(stem[1]).toBeGreaterThan(stem[2] + 15)

    const rectangleMargin = sampleWorld(lit, -1.68, 0.18)
    expect(colorDistance(rectangleMargin, receiver)).toBeLessThan(18)
    const rectangleCenterY = worldToPixel(-1.325, 0.5).y
    const edgeDistances = Array.from({ length: 96 }, (_, index) =>
      colorDistance(pixelAt(lit, 35 + index, rectangleCenterY), receiver),
    )
    const maximumEdgeDistance = Math.max(...edgeDistances)
    expect(Math.min(...edgeDistances)).toBeLessThan(18)
    expect(maximumEdgeDistance).toBeGreaterThan(45)
    expect(
      edgeDistances.some((distance) => distance >= 8 && distance <= maximumEdgeDistance - 8),
    ).toBe(true)

    const rectangleShadow = darkerBy(lit, cast, -0.965, -0.05)
    const circleShadow = darkerBy(lit, cast, 0.835, -0.05)
    const circleShadowCutout = darkerBy(lit, cast, 0.51, -0.16)
    expect(rectangleShadow).toBeGreaterThan(8)
    expect(circleShadow).toBeGreaterThan(8)
    expect(circleShadowCutout).toBeLessThan(Math.min(rectangleShadow, circleShadow) * 0.55)

    const receivedShadow = darkerBy(lit, receive, 0.475, 0.5)
    const unshadowedGlyph = darkerBy(lit, receive, -1.325, 0.5)
    expect(receivedShadow).toBeGreaterThan(8)
    expect(unshadowedGlyph).toBeLessThan(receivedShadow * 0.55)
    expect(
      colorDistance(sampleWorld(shadowed, 0.12, 0.18), sampleWorld(lit, 0.12, 0.18)),
    ).toBeLessThan(18)

    const restored = await captureMode(harness, 'lit')
    expect(
      colorDistance(sampleWorld(restored, 0.475, 0.5), sampleWorld(lit, 0.475, 0.5)),
    ).toBeLessThan(8)

    const finalShadowed = await captureMode(harness, 'shadow')
    expect(
      colorDistance(sampleWorld(finalShadowed, 0.475, 0.5), sampleWorld(shadowed, 0.475, 0.5)),
    ).toBeLessThan(8)

    await page.screenshot({
      element: harness.renderer.domElement,
      path: '../artifacts/lit-text-shadow-seam.png',
    })
    await (
      commands as unknown as {
        recordObservation(observation: unknown): Promise<void>
      }
    ).recordObservation({
      kind: 'lit-text-shadow-seam',
      three: '0.185.1',
      adapter: harness.adapterInfo,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      viewport: { ...VIEWPORT, dpr: devicePixelRatio },
      fixture: {
        atlasSha256: '75958a3cea4f6dc6df4d15ebfcb822c5b2b113523ad65469dd9704aa4430c15a',
        instances: 4,
        normal: [0, 0, 1],
        shadowSide: 'visible-front-side',
      },
      material: {
        metalness: 0,
        roughness: 0.9,
        publicNodes: ['positionNode', 'colorNode', 'opacityNode', 'maskShadowNode'],
      },
      observations: {
        lightGain,
        rectangleShadow,
        circleShadow,
        circleShadowCutout,
        receivedShadow,
        unshadowedGlyph,
      },
    })
  })

  test('creates a fresh lit shadow lifecycle after disposal', async () => {
    const first = await createMountedHarness()
    await captureMode(first, 'shadow')
    first.dispose()
    disposeMountedHarnesses.shift()

    const second = await createMountedHarness()
    const lit = await captureMode(second, 'lit')
    expect(luminance(sampleWorld(lit, -1.325, 0.5))).toBeGreaterThan(40)
  })

  test('rejects missing WebGPU as unsupported lit evidence', async () => {
    const ownDescriptor = Object.getOwnPropertyDescriptor(navigator, 'gpu')
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined })
    await expect(
      createLitShadowHarness(document.body),
    ).rejects.toMatchObject<UnsupportedWebGPUError>({ name: 'UnsupportedWebGPUError' })
    if (ownDescriptor) Object.defineProperty(navigator, 'gpu', ownDescriptor)
    else Reflect.deleteProperty(navigator, 'gpu')
  })
})

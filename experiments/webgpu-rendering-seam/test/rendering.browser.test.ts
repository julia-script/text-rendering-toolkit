import { Color, Vector4 } from 'three/webgpu'
import { afterEach, describe, expect, test } from 'vitest'
import { commands, page } from 'vitest/browser'

import { createRenderHarness, type UnsupportedWebGPUError, VIEWPORT } from '../src/harness.js'

const BACKGROUND = [16, 24, 32] as const
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

function colorDistance(left: readonly number[], right: readonly number[]) {
  return Math.hypot(
    (left[0] ?? 0) - (right[0] ?? 0),
    (left[1] ?? 0) - (right[1] ?? 0),
    (left[2] ?? 0) - (right[2] ?? 0),
  )
}

function worldToPixel(x: number, y: number) {
  return {
    x: ((x + 2) / 4) * VIEWPORT.width,
    y: ((1 - y) / 2) * VIEWPORT.height,
  }
}

function occupiedBounds(image: ImageData) {
  let minimumX = image.width
  let minimumY = image.height
  let maximumX = -1
  let maximumY = -1
  let count = 0
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (colorDistance(pixelAt(image, x, y), BACKGROUND) > 12) {
        minimumX = Math.min(minimumX, x)
        minimumY = Math.min(minimumY, y)
        maximumX = Math.max(maximumX, x)
        maximumY = Math.max(maximumY, y)
        count += 1
      }
    }
  }
  return { minimumX, minimumY, maximumX, maximumY, count }
}

async function createMountedHarness() {
  await page.viewport(VIEWPORT.width + 28, VIEWPORT.height + 28)
  const container = document.createElement('div')
  document.body.style.margin = '0'
  document.body.replaceChildren(container)
  const harness = await createRenderHarness(container)
  disposeMountedHarnesses.push(harness.dispose)
  return harness
}

afterEach(() => {
  for (const dispose of disposeMountedHarnesses.splice(0)) dispose()
  document.body.replaceChildren()
})

describe('actual WebGPU rendering seam', () => {
  test('renders channel-selected, colored, antialiased SDF instances', async () => {
    const harness = await createMountedHarness()
    await harness.render()
    const image = await harness.capturePixels()

    await (
      commands as unknown as {
        recordObservation(observation: unknown): Promise<void>
      }
    ).recordObservation({
      adapter: harness.adapterInfo,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      viewport: VIEWPORT,
    })

    const centers = [-1.325, -0.425, 0.475, 1.375].map((x) =>
      pixelAt(image, worldToPixel(x, 0.5).x, worldToPixel(x, 0.5).y),
    )
    expect(colorDistance(pixelAt(image, 20, 220), BACKGROUND)).toBeLessThan(6)
    expect(centers[0]?.[0]).toBeGreaterThan((centers[0]?.[1] ?? 0) + 35)
    expect(centers[1]?.[1]).toBeGreaterThan((centers[1]?.[0] ?? 0) + 35)
    expect(centers[2]?.[2]).toBeGreaterThan((centers[2]?.[0] ?? 0) + 35)
    expect(centers[3]?.[0]).toBeGreaterThan((centers[3]?.[2] ?? 0) + 35)
    expect(centers[3]?.[1]).toBeGreaterThan((centers[3]?.[2] ?? 0) + 25)

    const rectangleCenterY = worldToPixel(-1.325, 0.5).y
    const edgeDistances = Array.from({ length: 64 }, (_, index) =>
      colorDistance(pixelAt(image, 32 + index, rectangleCenterY), BACKGROUND),
    )
    expect(Math.min(...edgeDistances)).toBeLessThan(18)
    expect(Math.max(...edgeDistances)).toBeGreaterThan(45)
    const maximumEdgeDistance = Math.max(...edgeDistances)
    expect(
      edgeDistances.some((distance) => distance >= 8 && distance <= maximumEdgeDistance - 8),
    ).toBe(true)

    await page.screenshot({
      element: harness.renderer.domElement,
      path: '../artifacts/webgpu-rendering-seam.png',
    })
  })

  test('applies opacity, clipping, orientation, and cylindrical curvature', async () => {
    const harness = await createMountedHarness()
    await harness.render()
    const baseline = await harness.capturePixels()
    const baselineBounds = occupiedBounds(baseline)
    const redCenter = worldToPixel(-1.325, 0.5)
    const baselineRed = pixelAt(baseline, redCenter.x, redCenter.y)

    harness.setAppearance({ opacity: 0.35 })
    await harness.render()
    const faded = await harness.capturePixels()
    expect(colorDistance(pixelAt(faded, redCenter.x, redCenter.y), BACKGROUND)).toBeLessThan(
      colorDistance(baselineRed, BACKGROUND) * 0.65,
    )

    harness.setAppearance({
      clipRect: new Vector4(-2, -1, 0, 1),
      curveRadius: 1.8,
      opacity: 0.82,
      rotation: 0.12,
    })
    await harness.render()
    const transformed = await harness.capturePixels()
    const transformedBounds = occupiedBounds(transformed)
    expect(
      colorDistance(pixelAt(transformed, worldToPixel(1.375, 0.5).x, 64), BACKGROUND),
    ).toBeLessThan(12)
    expect(transformedBounds.count).toBeGreaterThan(500)
    expect(transformedBounds.count).toBeLessThan(baselineBounds.count * 0.75)
    expect(transformedBounds.minimumY).not.toBe(baselineBounds.minimumY)
    expect(transformedBounds.minimumX).not.toBe(baselineBounds.minimumX)
  })

  test('uploads atlas and instance mutations without disturbing untouched instances', async () => {
    const harness = await createMountedHarness()
    await harness.render()
    const baseline = await harness.capturePixels()
    const centers = [-1.325, -0.425, 0.475, 1.375].map((x) => worldToPixel(x, 0.5))

    harness.mutateAtlasChannel(0)
    harness.mutateInstance(3, [0.9, -0.75, 1.65, -0.05], new Color(0x22e8e8))
    await harness.render()
    const updated = await harness.capturePixels()

    expect(
      colorDistance(
        pixelAt(updated, centers[0]?.x ?? 0, centers[0]?.y ?? 0),
        pixelAt(baseline, centers[0]?.x ?? 0, centers[0]?.y ?? 0),
      ),
    ).toBeGreaterThan(45)
    for (const index of [1, 2]) {
      const center = centers[index]
      expect(
        colorDistance(
          pixelAt(updated, center?.x ?? 0, center?.y ?? 0),
          pixelAt(baseline, center?.x ?? 0, center?.y ?? 0),
        ),
      ).toBeLessThan(8)
    }
    expect(
      colorDistance(pixelAt(updated, centers[3]?.x ?? 0, centers[3]?.y ?? 0), BACKGROUND),
    ).toBeLessThan(12)
    const movedCenter = worldToPixel(1.275, -0.4)
    const movedPixel = pixelAt(updated, movedCenter.x, movedCenter.y)
    expect(movedPixel[1]).toBeGreaterThan(movedPixel[0] + 25)
    expect(movedPixel[2]).toBeGreaterThan(movedPixel[0] + 25)
  })

  test('creates a fresh working lifecycle after disposal', async () => {
    const first = await createMountedHarness()
    await first.render()
    first.dispose()
    disposeMountedHarnesses.shift()

    const second = await createMountedHarness()
    await second.render()
    expect(occupiedBounds(await second.capturePixels()).count).toBeGreaterThan(1_000)
  })

  test('rejects missing WebGPU as unsupported evidence', async () => {
    const ownDescriptor = Object.getOwnPropertyDescriptor(navigator, 'gpu')
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined })
    await expect(createRenderHarness(document.body)).rejects.toMatchObject<UnsupportedWebGPUError>({
      name: 'UnsupportedWebGPUError',
    })
    if (ownDescriptor) Object.defineProperty(navigator, 'gpu', ownDescriptor)
    else Reflect.deleteProperty(navigator, 'gpu')
  })
})

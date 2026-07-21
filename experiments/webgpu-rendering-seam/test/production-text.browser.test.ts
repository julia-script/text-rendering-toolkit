import { type FontHandle, loadFont } from '@webgpu-text/font'
import {
  getSelectionRects,
  layoutResolvedText,
  type ResolvedLayoutInput,
  type ResolvedShapedRun,
} from '@webgpu-text/layout'
import { Text } from '@webgpu-text/three'
import {
  Color,
  OrthographicCamera,
  Scene,
  WebGPURenderer,
  type WebGPURendererParameters,
} from 'three/webgpu'
import { afterEach, describe, expect, test } from 'vitest'
import { commands, page } from 'vitest/browser'

const WIDTH = 512
const HEIGHT = 256
const BACKGROUND = [16, 24, 32] as const
const latinUrl = new URL(
  '../../../test-fixtures/fonts/harfbuzz-validation/NotoSans-wdth-wght.ttf',
  import.meta.url,
)
const arabicUrl = new URL(
  '../../../test-fixtures/fonts/harfbuzz-validation/NotoSansArabic-wdth-wght.ttf',
  import.meta.url,
)
const disposers: Array<() => void> = []

function resolvedRun(
  font: FontHandle,
  source: string,
  start: number,
  end: number,
  fontKey: string,
  styleKey: string,
  direction: 'ltr' | 'rtl',
  script: string,
  language: string,
  fontSize: number,
): ResolvedShapedRun {
  const shaped = font.shape({
    text: source.slice(start, end),
    direction,
    script,
    language,
  })
  const scale = fontSize / font.facts.unitsPerEm
  return {
    start,
    end,
    direction,
    bidiLevel: direction === 'rtl' ? 1 : 0,
    script,
    language,
    styleKey,
    fontKey,
    fontSize,
    fontUnitScale: scale,
    metrics: {
      ascender: font.facts.ascender * scale,
      descender: font.facts.descender * scale,
      lineGap: font.facts.lineGap * scale,
    },
    variations: shaped.variations,
    glyphs: shaped.glyphs.map((glyph) => ({
      start: start + glyph.clusterStart,
      end: start + glyph.clusterEnd,
      glyphId: glyph.glyphId,
      xAdvance: glyph.xAdvance * scale,
      yAdvance: glyph.yAdvance * scale,
      xOffset: glyph.xOffset * scale,
      yOffset: glyph.yOffset * scale,
      flags: glyph.flags,
      bounds: null,
    })),
  }
}

function input(fonts: { latin: FontHandle; arabic: FontHandle }, withNewGlyph: boolean) {
  const latin = withNewGlyph ? 'WebGPU Z ' : 'WebGPU '
  const arabic = 'مرحبا'
  const text = `${latin}${arabic}`
  const latinRun = resolvedRun(
    fonts.latin,
    text,
    0,
    latin.length,
    'latin',
    'latin',
    'ltr',
    'Latn',
    'en',
    0.34,
  )
  const arabicRun = resolvedRun(
    fonts.arabic,
    text,
    latin.length,
    text.length,
    'arabic',
    'arabic',
    'rtl',
    'Arab',
    'ar',
    0.34,
  )
  return {
    text,
    paragraphLevel: 0,
    defaultMetrics: latinRun.metrics,
    maxWidth: null,
    whiteSpace: 'normal',
    overflowWrap: 'normal',
    textAlign: 'left',
    textIndent: 0,
    letterSpacing: 0,
    lineHeight: 'normal',
    anchorX: -1.7,
    anchorY: 0,
    runs: [latinRun, arabicRun],
  } satisfies ResolvedLayoutInput
}

function layout(fonts: { latin: FontHandle; arabic: FontHandle }, withNewGlyph: boolean) {
  return layoutResolvedText(input(fonts, withNewGlyph))
}

function pixelAt(image: ImageData, x: number, y: number) {
  const offset = (y * image.width + x) * 4
  return [
    image.data[offset] ?? 0,
    image.data[offset + 1] ?? 0,
    image.data[offset + 2] ?? 0,
  ] as const
}

function distance(left: readonly number[], right: readonly number[]) {
  return Math.hypot(
    (left[0] ?? 0) - (right[0] ?? 0),
    (left[1] ?? 0) - (right[1] ?? 0),
    (left[2] ?? 0) - (right[2] ?? 0),
  )
}

function observations(image: ImageData) {
  let occupied = 0
  let cyan = 0
  let yellow = 0
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const pixel = pixelAt(image, x, y)
      if (distance(pixel, BACKGROUND) > 12) occupied += 1
      if (pixel[1] > pixel[0] + 15 && pixel[2] > pixel[0] + 15) cyan += 1
      if (pixel[0] > pixel[2] + 15 && pixel[1] > pixel[2] + 10) yellow += 1
    }
  }
  return { occupied, cyan, yellow }
}

function changedPixels(left: ImageData, right: ImageData, maximumX = left.width) {
  let changed = 0
  for (let y = 0; y < left.height; y += 1) {
    for (let x = 0; x < maximumX; x += 1) {
      if (distance(pixelAt(left, x, y), pixelAt(right, x, y)) > 8) changed += 1
    }
  }
  return changed
}

async function capture(renderer: WebGPURenderer): Promise<ImageData> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    renderer.domElement.toBlob((value) =>
      value ? resolve(value) : reject(new Error('Unable to capture WebGPU canvas')),
    )
  })
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('2D capture context is unavailable')
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  return context.getImageData(0, 0, WIDTH, HEIGHT)
}

async function load(url: URL) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Unable to fetch fixture font: ${response.status}`)
  return loadFont(await response.arrayBuffer())
}

async function createHarness() {
  if (!navigator.gpu) throw new Error('WebGPU is unavailable; WebGL fallback is not evidence')
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' })
  if (!adapter) throw new Error('No WebGPU adapter; WebGL fallback is not evidence')
  const fonts = { latin: await load(latinUrl), arabic: await load(arabicUrl) }
  const renderer = new WebGPURenderer({
    alpha: false,
    antialias: false,
  } as WebGPURendererParameters)
  renderer.setPixelRatio(1)
  renderer.setSize(WIDTH, HEIGHT, false)
  await renderer.init()
  if (
    (renderer.backend as typeof renderer.backend & { isWebGPUBackend?: boolean })
      .isWebGPUBackend !== true
  ) {
    renderer.dispose()
    fonts.latin.dispose()
    fonts.arabic.dispose()
    throw new Error('Three selected a non-WebGPU backend')
  }
  const scene = new Scene()
  scene.background = new Color(0x101820)
  const camera = new OrthographicCamera(-2, 2, 1, -1, 0.1, 10)
  camera.position.z = 3
  const text = new Text({
    layout: layout(fonts, false),
    fonts: new Map([
      ['latin', fonts.latin],
      ['arabic', fonts.arabic],
    ]),
    styleColors: { latin: 0x33ccff, arabic: 0xffcc33 },
    opacity: 0.82,
    sdfSize: 64,
  })
  await text.sync()
  scene.add(text)
  document.body.style.margin = '0'
  document.body.replaceChildren(renderer.domElement)
  const dispose = () => {
    scene.remove(text)
    text.dispose()
    renderer.dispose()
    renderer.domElement.remove()
    fonts.latin.dispose()
    fonts.arabic.dispose()
  }
  disposers.push(dispose)
  return {
    adapter,
    fonts,
    renderer,
    text,
    render: async () => {
      renderer.render(scene, camera)
      await Promise.resolve()
    },
    dispose,
  }
}

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose()
  document.body.replaceChildren()
})

describe('production @webgpu-text/three actual-WebGPU evidence', () => {
  test('renders, updates, reuses prepared layout, and disposes public real-font text', async () => {
    await page.viewport(WIDTH + 24, HEIGHT + 24)
    const harness = await createHarness()
    await harness.render()
    const baseline = await capture(harness.renderer)
    const baselineObservation = observations(baseline)
    const initialCount = harness.text.geometry.instanceCount
    const initialSlots = harness.text.geometry.getAttribute('glyphSlot').array
    expect(Math.max(...[...initialSlots].slice(0, initialCount))).toBeGreaterThanOrEqual(4)
    expect(baselineObservation.occupied).toBeGreaterThan(800)
    expect(baselineObservation.cyan).toBeGreaterThan(100)
    expect(baselineObservation.yellow).toBeGreaterThan(100)
    const committed = harness.text.layoutResult
    if (!committed) throw new Error('Expected a committed renderer-neutral layout')
    expect(
      getSelectionRects(committed, { start: 0, end: committed.sourceLengthUtf16 }).length,
    ).toBeGreaterThan(0)

    harness.text.layout = layout(harness.fonts, true)
    harness.text.clipRect = { left: -1.7, bottom: -0.5, right: 0.7, top: 0.8 }
    await harness.text.sync()
    await harness.render()
    const updated = await capture(harness.renderer)
    expect(harness.text.geometry.instanceCount).toBeGreaterThan(initialCount)
    expect(changedPixels(baseline, updated)).toBeGreaterThan(100)
    expect(changedPixels(baseline, updated, 110)).toBeLessThan(30)

    await page.screenshot({
      element: harness.renderer.domElement,
      path: '../artifacts/three-webgpu-text-core.png',
    })
    await (
      commands as unknown as {
        recordObservation(observation: unknown): Promise<void>
      }
    ).recordObservation({
      kind: 'three-webgpu-text-core',
      three: '0.185.1',
      adapter: {
        architecture: harness.adapter.info.architecture,
        description: harness.adapter.info.description,
        device: harness.adapter.info.device,
        vendor: harness.adapter.info.vendor,
      },
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      viewport: { width: WIDTH, height: HEIGHT, dpr: 1 },
      initialInstanceCount: initialCount,
      updatedInstanceCount: harness.text.geometry.instanceCount,
      initialSemanticPixels: baselineObservation,
      fixtureFonts: 'NotoSans-wdth-wght.ttf + NotoSansArabic-wdth-wght.ttf',
    })

    harness.dispose()
    disposers.shift()
    const second = await createHarness()
    await second.render()
    expect(observations(await capture(second.renderer)).occupied).toBeGreaterThan(800)
  })

  test('rejects unavailable WebGPU instead of accepting fallback', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'gpu')
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined })
    await expect(createHarness()).rejects.toThrow('WebGL fallback is not evidence')
    if (descriptor) Object.defineProperty(navigator, 'gpu', descriptor)
    else Reflect.deleteProperty(navigator, 'gpu')
  })
})

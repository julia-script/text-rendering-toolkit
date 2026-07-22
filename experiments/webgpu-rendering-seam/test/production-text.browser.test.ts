import { type FontHandle, loadFont } from '@webgpu-text/font'
import {
  getSelectionRects,
  layoutResolvedText,
  type ResolvedLayoutInput,
  type ResolvedShapedRun,
} from '@webgpu-text/layout'
import { Text, type TextFont, TextResources } from '@webgpu-text/three'
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardNodeMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  WebGPURenderer,
  type WebGPURendererParameters,
} from 'three/webgpu'
import { afterEach, describe, expect, test } from 'vitest'
import { commands, page } from 'vitest/browser'

const WIDTH = 512
const HEIGHT = 256
const BACKGROUND = [16, 24, 32] as const
type SceneMode = 'ambient' | 'cast' | 'lit' | 'receive' | 'shadow'
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
      decorationMetrics: {
        underlinePosition: font.facts.decorationMetrics.underlinePosition * scale,
        underlineThickness: font.facts.decorationMetrics.underlineThickness * scale,
        strikethroughPosition: font.facts.decorationMetrics.strikethroughPosition * scale,
        strikethroughThickness: font.facts.decorationMetrics.strikethroughThickness * scale,
      },
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
  const latin = withNewGlyph ? 'IO WebGPU Z ' : 'IO WebGPU '
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

function growthLayout(font: FontHandle) {
  const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789'
  const run = resolvedRun(font, text, 0, text.length, 'latin', 'latin', 'ltr', 'Latn', 'en', 0.18)
  return layoutResolvedText({
    text,
    paragraphLevel: 0,
    defaultMetrics: run.metrics,
    maxWidth: null,
    whiteSpace: 'normal',
    overflowWrap: 'normal',
    textAlign: 'left',
    textIndent: 0,
    letterSpacing: 0,
    lineHeight: 'normal',
    anchorX: -1.7,
    anchorY: 0,
    runs: [run],
  })
}

function pixelAt(image: ImageData, x: number, y: number) {
  const offset = (Math.floor(y) * image.width + Math.floor(x)) * 4
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
  for (let y = 0; y < Math.floor(image.height * 0.45); y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const pixel = pixelAt(image, x, y)
      if (distance(pixel, BACKGROUND) > 12) occupied += 1
      if (pixel[1] > pixel[0] + 15 && pixel[2] > pixel[0] + 15) cyan += 1
      if (pixel[0] > pixel[2] + 15 && pixel[1] > pixel[2] + 10) yellow += 1
    }
  }
  return { occupied, cyan, yellow }
}

function luminance(color: readonly number[]) {
  return (color[0] ?? 0) * 0.2126 + (color[1] ?? 0) * 0.7152 + (color[2] ?? 0) * 0.0722
}

function worldToPixel(x: number, y: number) {
  return { x: ((x + 2) / 4) * WIDTH, y: ((1 - y) / 2) * HEIGHT }
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

function darkerBy(lit: ImageData, shadowed: ImageData, x: number, y: number) {
  return luminance(sampleWorld(lit, x, y)) - luminance(sampleWorld(shadowed, x, y))
}

function changedPixels(
  left: ImageData,
  right: ImageData,
  maximumX = left.width,
  maximumY = left.height,
) {
  let changed = 0
  for (let y = 0; y < maximumY; y += 1) {
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
  renderer.shadowMap.enabled = true
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
  camera.position.z = 5
  const outlineCalls = { latin: 0, arabic: 0 }
  const renderFonts = new Map<string, TextFont>([
    [
      'latin',
      {
        getOutline(glyphId, variations) {
          outlineCalls.latin += 1
          return fonts.latin.getOutline(glyphId, variations)
        },
      },
    ],
    [
      'arabic',
      {
        getOutline(glyphId, variations) {
          outlineCalls.arabic += 1
          return fonts.arabic.getOutline(glyphId, variations)
        },
      },
    ],
  ])
  const resources = new TextResources({ sdfSize: 64 })
  const text = new Text({
    layout: layout(fonts, false),
    fonts: renderFonts,
    resources,
    lit: true,
    styleColors: { latin: 0x33ccff, arabic: 0xffcc33 },
    opacity: 1,
  })
  await text.sync()
  const outlineCallsAfterPrimary = outlineCalls.latin + outlineCalls.arabic
  const secondary = new Text({
    layout: layout(fonts, false),
    fonts: renderFonts,
    resources,
    styleColors: { latin: 0x99ff77, arabic: 0xff88cc },
  })
  await secondary.sync()
  const outlineCallsAfterDuplicate = outlineCalls.latin + outlineCalls.arabic
  text.position.y = 0.25
  secondary.position.y = -0.55
  secondary.scale.setScalar(0.55)

  const receiverGeometry = new PlaneGeometry(4, 1.2)
  const receiverMaterial = new MeshStandardNodeMaterial({
    color: new Color(0x78828c),
    metalness: 0,
    roughness: 1,
  })
  const receiver = new Mesh(receiverGeometry, receiverMaterial)
  receiver.position.set(0, -0.4, -0.6)

  const occluderGeometry = new BoxGeometry(0.2, 0.26, 0.06)
  const occluderMaterial = new MeshStandardNodeMaterial({
    color: new Color(0xffffff),
    metalness: 0,
    roughness: 1,
  })
  occluderMaterial.colorWrite = false
  occluderMaterial.depthWrite = false
  const occluder = new Mesh(occluderGeometry, occluderMaterial)

  const firstBounds = text.geometry.getAttribute('glyphBounds').array
  const firstCenterX = ((firstBounds[0] ?? 0) + (firstBounds[2] ?? 0)) / 2
  const firstCenterY = ((firstBounds[1] ?? 0) + (firstBounds[3] ?? 0)) / 2 + text.position.y
  occluder.position.set(firstCenterX - 0.72, firstCenterY + 0.72, 1.2)

  const ambient = new AmbientLight(0xffffff, 0.12)
  const directional = new DirectionalLight(0xffffff, 2.4)
  directional.position.set(-3, 3, 5)
  directional.target.position.set(0, 0, 0)
  directional.shadow.mapSize.set(1024, 1024)
  directional.shadow.camera.left = -4
  directional.shadow.camera.right = 4
  directional.shadow.camera.top = 3
  directional.shadow.camera.bottom = -3
  directional.shadow.camera.near = 0.1
  directional.shadow.camera.far = 12
  directional.shadow.camera.updateProjectionMatrix()
  directional.shadow.bias = -0.0005
  directional.shadow.normalBias = 0.01

  scene.add(receiver, text, secondary, occluder, ambient, directional, directional.target)

  function setMode(mode: SceneMode) {
    const castText = mode === 'cast' || mode === 'shadow'
    const receiveOnText = mode === 'receive' || mode === 'shadow'
    directional.intensity = mode === 'ambient' ? 0 : 2.4
    directional.castShadow = castText || receiveOnText
    text.castShadow = castText
    text.receiveShadow = receiveOnText
    receiver.receiveShadow = castText
    occluder.castShadow = receiveOnText
  }

  setMode('lit')
  document.body.style.margin = '0'
  document.body.replaceChildren(renderer.domElement)
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    scene.clear()
    text.dispose()
    secondary.dispose()
    resources.dispose()
    receiverGeometry.dispose()
    receiverMaterial.dispose()
    occluderGeometry.dispose()
    occluderMaterial.dispose()
    directional.dispose()
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
    secondary,
    resources,
    outlineCalls,
    outlineCallsAfterPrimary,
    outlineCallsAfterDuplicate,
    setMode,
    render: async () => {
      renderer.render(scene, camera)
      await Promise.resolve()
    },
    dispose,
  }
}

async function captureMode(harness: Awaited<ReturnType<typeof createHarness>>, mode: SceneMode) {
  harness.setMode(mode)
  await harness.render()
  await harness.render()
  return capture(harness.renderer)
}

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose()
  document.body.replaceChildren()
})

describe('production @webgpu-text/three actual-WebGPU evidence', () => {
  test('lights, shadows, updates, and disposes public real-font text', async () => {
    await page.viewport(WIDTH + 24, HEIGHT + 24)
    const harness = await createHarness()
    const ambient = await captureMode(harness, 'ambient')
    const lit = await captureMode(harness, 'lit')
    const cast = await captureMode(harness, 'cast')
    const receive = await captureMode(harness, 'receive')
    const baselineObservation = observations(lit)
    const initialCount = harness.text.geometry.instanceCount
    const initialSlots = harness.text.geometry.getAttribute('glyphSlot').array
    expect(Math.max(...[...initialSlots].slice(0, initialCount))).toBeGreaterThanOrEqual(4)
    expect(baselineObservation.occupied).toBeGreaterThan(800)
    expect(baselineObservation.cyan).toBeGreaterThan(100)
    expect(baselineObservation.yellow).toBeGreaterThan(100)
    expect(harness.outlineCallsAfterDuplicate).toBe(harness.outlineCallsAfterPrimary)
    const material = harness.text.material
    if (!(material instanceof MeshStandardNodeMaterial)) {
      throw new Error('Expected the production planar standard material')
    }

    const instanceBounds = harness.text.geometry.getAttribute('glyphBounds').array
    const iCenter = {
      x: ((instanceBounds[0] ?? 0) + (instanceBounds[2] ?? 0)) / 2,
      y: ((instanceBounds[1] ?? 0) + (instanceBounds[3] ?? 0)) / 2 + harness.text.position.y,
    }
    const oBounds = {
      left: instanceBounds[4] ?? 0,
      bottom: (instanceBounds[5] ?? 0) + harness.text.position.y,
      right: instanceBounds[6] ?? 0,
      top: (instanceBounds[7] ?? 0) + harness.text.position.y,
    }
    const oStroke = {
      x: oBounds.left + (oBounds.right - oBounds.left) * 0.28,
      y: (oBounds.bottom + oBounds.top) / 2,
    }
    const oCutout = {
      x: (oBounds.left + oBounds.right) / 2,
      y: (oBounds.bottom + oBounds.top) / 2,
    }
    const lightGain =
      luminance(sampleWorld(lit, iCenter.x, iCenter.y)) -
      luminance(sampleWorld(ambient, iCenter.x, iCenter.y))
    expect(lightGain).toBeGreaterThan(8)
    const castShadow = darkerBy(lit, cast, oStroke.x + 0.36, oStroke.y - 0.36)
    const castCutout = darkerBy(lit, cast, oCutout.x + 0.36, oCutout.y - 0.36)
    expect(castShadow).toBeGreaterThan(6)
    expect(castCutout).toBeLessThan(castShadow * 0.6)
    const receivedShadow = darkerBy(lit, receive, iCenter.x, iCenter.y)
    const unshadowedGlyph = darkerBy(lit, receive, oStroke.x, oStroke.y)
    expect(receivedShadow).toBeGreaterThan(6)
    expect(unshadowedGlyph).toBeLessThan(receivedShadow * 0.6)
    const committed = harness.text.layoutResult
    if (!committed) throw new Error('Expected a committed renderer-neutral layout')
    expect(
      getSelectionRects(committed, { start: 0, end: committed.sourceLengthUtf16 }).length,
    ).toBeGreaterThan(0)

    harness.text.layout = layout(harness.fonts, true)
    harness.text.clipRect = { left: -1.7, bottom: -0.5, right: 0.7, top: 0.8 }
    await harness.text.sync()
    const updated = await captureMode(harness, 'lit')
    expect(harness.text.geometry.instanceCount).toBeGreaterThan(initialCount)
    expect(changedPixels(lit, updated)).toBeGreaterThan(100)
    expect(changedPixels(lit, updated, 110)).toBeLessThan(30)

    const primaryLayoutBeforeSharedGrowth = harness.text.layoutResult
    const primarySlotsBeforeSharedGrowth = [
      ...harness.text.geometry.getAttribute('glyphSlot').array,
    ].slice(0, harness.text.geometry.instanceCount)
    harness.secondary.layout = growthLayout(harness.fonts.latin)
    await harness.secondary.sync()
    const grown = await captureMode(harness, 'lit')
    const growthSlots = [...harness.secondary.geometry.getAttribute('glyphSlot').array].slice(
      0,
      harness.secondary.geometry.instanceCount,
    )
    expect(Math.max(...growthSlots)).toBeGreaterThanOrEqual(16)
    expect(harness.text.layoutResult).toBe(primaryLayoutBeforeSharedGrowth)
    expect(
      [...harness.text.geometry.getAttribute('glyphSlot').array].slice(
        0,
        harness.text.geometry.instanceCount,
      ),
    ).toEqual(primarySlotsBeforeSharedGrowth)
    expect(changedPixels(updated, grown, WIDTH, Math.floor(HEIGHT * 0.45))).toBeLessThan(40)
    const outlineCallsAfterGrowth = harness.outlineCalls.latin + harness.outlineCalls.arabic
    expect(outlineCallsAfterGrowth).toBeGreaterThan(harness.outlineCallsAfterDuplicate)

    await captureMode(harness, 'shadow')

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
      sharedResources: {
        primaryInstanceCount: harness.text.geometry.instanceCount,
        secondaryGrowthInstanceCount: harness.secondary.geometry.instanceCount,
        outlineCallsAfterPrimary: harness.outlineCallsAfterPrimary,
        outlineCallsAfterDuplicate: harness.outlineCallsAfterDuplicate,
        outlineCallsAfterGrowth,
        maximumSlotAfterGrowth: Math.max(...growthSlots),
        primaryChangedPixelsAfterBorrowerGrowth: changedPixels(
          updated,
          grown,
          WIDTH,
          Math.floor(HEIGHT * 0.45),
        ),
      },
      initialSemanticPixels: baselineObservation,
      litSemanticPixels: {
        lightGain,
        castShadow,
        castCutout,
        receivedShadow,
        unshadowedGlyph,
      },
      material: {
        lit: harness.text.lit,
        metalness: material.metalness,
        roughness: material.roughness,
        publicNodes: ['positionNode', 'colorNode', 'opacityNode', 'maskShadowNode'],
      },
      fixtureFonts: 'NotoSans-wdth-wght.ttf + NotoSansArabic-wdth-wght.ttf',
    })

    harness.dispose()
    disposers.shift()
    const second = await createHarness()
    await captureMode(second, 'shadow')
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

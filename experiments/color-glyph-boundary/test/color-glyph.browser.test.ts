import { loadFont } from '@text-rendering-toolkit/font'
import { layoutPreparedText, prepareText } from '@text-rendering-toolkit/layout'
import { Text, type TextFont, TextResources } from '@text-rendering-toolkit/three-webgpu'
import {
  AmbientLight,
  Color,
  DirectionalLight,
  OrthographicCamera,
  Scene,
  WebGPURenderer,
  type WebGPURendererParameters,
} from 'three/webgpu'
import { afterEach, describe, expect, test } from 'vitest'
import { commands } from 'vitest/browser'

const WIDTH = 512
const HEIGHT = 256
const emojiUrl = new URL(
  '../../../test-fixtures/fonts/color-glyph-validation/noto-validation-colr-v0.ttf',
  import.meta.url,
)
const latinUrl = new URL(
  '../../../test-fixtures/fonts/harfbuzz-validation/NotoSans-wdth-wght.ttf',
  import.meta.url,
)
const bridgeModuleUrl = new URL('../.cache/harfbuzzjs/dist/harfbuzz.js', import.meta.url)
const bridgeWasmUrl = new URL('../.cache/harfbuzzjs/dist/harfbuzz.wasm', import.meta.url)
const disposers: Array<() => void> = []

async function bytes(url: URL): Promise<Uint8Array> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Unable to fetch ${url}: ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
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

function semantics(image: ImageData) {
  let opaque = 0
  let transparent = 0
  let chromatic = 0
  let semiTransparent = 0
  let boundedAlpha = true
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const red = image.data[offset] ?? 0
    const green = image.data[offset + 1] ?? 0
    const blue = image.data[offset + 2] ?? 0
    const alpha = image.data[offset + 3] ?? 0
    if (alpha === 0) transparent += 1
    else opaque += 1
    if (alpha > 0 && alpha < 255) semiTransparent += 1
    if (Math.max(red, green, blue) - Math.min(red, green, blue) > 30 && alpha > 32) chromatic += 1
    boundedAlpha &&= alpha >= 0 && alpha <= 255
  }
  return { opaque, transparent, chromatic, semiTransparent, boundedAlpha }
}

async function record(observation: unknown) {
  await (
    commands as unknown as {
      recordColorGlyphObservation(observation: unknown): Promise<void>
    }
  ).recordColorGlyphObservation(observation)
}

afterEach(() => {
  while (disposers.length) disposers.pop()?.()
})

describe('color-glyph browser boundaries', () => {
  test('loads the reproducible HarfBuzz color bridge as browser ESM', async () => {
    const imported = (await import(/* @vite-ignore */ bridgeModuleUrl.href)) as {
      default(options: { locateFile(path: string): string }): Promise<unknown>
    }
    await imported.default({
      locateFile: (path) => (path.endsWith('.wasm') ? bridgeWasmUrl.href : path),
    })
    await record({
      schemaVersion: '1',
      kind: 'harfbuzz-color-bridge-browser',
      environment: { node: 'browser', platform: navigator.platform },
      evidence: [{ source: bridgeModuleUrl.pathname, integrity: 'harfbuzz-bridge.json' }],
      browser: navigator.userAgent,
      esmInitialization: 'pass',
      wasmLocation: bridgeWasmUrl.pathname,
    })
  })

  test('records a same-font browser canvas reference', async () => {
    const fontBytes = await bytes(emojiUrl)
    const face = new FontFace('ColorGlyphValidation', fontBytes.slice().buffer)
    await face.load()
    document.fonts.add(face)
    const canvas = document.createElement('canvas')
    canvas.width = WIDTH
    canvas.height = HEIGHT
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Canvas 2D is unavailable')
    context.clearRect(0, 0, WIDTH, HEIGHT)
    context.font = '96px ColorGlyphValidation'
    context.fillText('A😀✍🏽🇺🇸', 24, 140)
    const observation = semantics(context.getImageData(0, 0, WIDTH, HEIGHT))
    expect(observation.chromatic).toBeGreaterThan(200)
    await record({
      schemaVersion: '1',
      kind: 'browser-color-font-reference',
      environment: { node: 'browser', platform: navigator.platform },
      evidence: [{ source: emojiUrl.pathname, integrity: 'fixture-manifest-sha256' }],
      browser: navigator.userAgent,
      font: 'ColorGlyphValidation COLR v0',
      text: 'A😀✍🏽🇺🇸',
      semanticPixels: observation,
      authority: 'informational rendering reference; project shaping/layout remains authoritative',
    })
    document.fonts.delete(face)
  })

  test('renders the public mixed COLR v0 path through unlit and lit actual Three WebGPU', async () => {
    if (!navigator.gpu) throw new Error('WebGPU is unavailable; WebGL is not evidence')
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' })
    if (!adapter) throw new Error('No WebGPU adapter; WebGL is not evidence')
    const emojiBytes = await bytes(emojiUrl)
    const latinBytes = await bytes(latinUrl)
    const emoji = await loadFont(emojiBytes)
    const latin = await loadFont(latinBytes)
    const registry = new Map([
      ['emoji', emoji],
      ['emojiForeground', emoji],
      ['emojiAlpha', emoji],
      ['latin', latin],
    ])
    const outlineCalls = { emoji: 0, latin: 0 }
    const emojiFont = (paint: 'intrinsic' | 'foreground' | 'alpha'): TextFont => ({
      facts: emoji.facts,
      getOutline(glyphId, variations) {
        outlineCalls.emoji += 1
        return emoji.getOutline(glyphId, variations)
      },
      getColorLayers(glyphId) {
        const layers = emoji.getColorLayers(glyphId)
        if (!layers || paint === 'intrinsic') return layers
        return layers.map((layer) => ({
          glyphId: layer.glyphId,
          color:
            paint === 'foreground'
              ? 'foreground'
              : layer.color === 'foreground'
                ? { red: 255, green: 255, blue: 255, alpha: 96 }
                : { ...layer.color, alpha: 96 },
        }))
      },
    })
    const renderFonts = new Map<string, TextFont>([
      ['emoji', emojiFont('intrinsic')],
      ['emojiForeground', emojiFont('foreground')],
      ['emojiAlpha', emojiFont('alpha')],
      [
        'latin',
        {
          facts: latin.facts,
          getOutline(glyphId, variations) {
            outlineCalls.latin += 1
            return latin.getOutline(glyphId, variations)
          },
        },
      ],
    ])
    const textValue = 'A😀✍🏽🇺🇸B'
    const emojiStart = 1
    const foregroundStart = emojiStart + '😀'.length
    const alphaStart = foregroundStart + '✍🏽'.length
    const layoutAt = (fontSize: number) =>
      layoutPreparedText(
        prepareText({
          text: textValue,
          paragraphDirection: 'ltr',
          style: { key: 'latin', fontKeys: ['latin', 'emoji'], fontSize, language: 'en' },
          styleRanges: [
            {
              start: emojiStart,
              end: foregroundStart,
              style: { key: 'intrinsic', fontKeys: ['emoji', 'latin'], fontSize, language: 'und' },
            },
            {
              start: foregroundStart,
              end: alphaStart,
              style: {
                key: 'foreground',
                fontKeys: ['emojiForeground', 'latin'],
                fontSize,
                language: 'und',
              },
            },
            {
              start: alphaStart,
              end: textValue.length - 1,
              style: {
                key: 'alpha',
                fontKeys: ['emojiAlpha', 'latin'],
                fontSize,
                language: 'und',
              },
            },
          ],
          layout: { anchorX: 'center', anchorY: 'middle' },
        }),
        registry,
      )
    const smallLayout = layoutAt(0.55)
    const largeLayout = layoutAt(0.82)
    const resources = new TextResources({ sdfSize: 64, sdfPadding: 0.4 })

    const renderer = new WebGPURenderer({
      alpha: true,
      antialias: false,
    } as WebGPURendererParameters)
    renderer.setPixelRatio(1)
    renderer.setSize(WIDTH, HEIGHT, false)
    renderer.setClearColor(new Color(0x000000), 0)
    await renderer.init()
    renderer.shadowMap.enabled = true
    if (
      (renderer.backend as typeof renderer.backend & { isWebGPUBackend?: boolean })
        .isWebGPUBackend !== true
    ) {
      throw new Error('Three selected a non-WebGPU backend')
    }
    const scene = new Scene()
    const camera = new OrthographicCamera(-3, 3, 1.5, -1.5, 0.1, 10)
    camera.position.z = 5
    const small = new Text({
      layout: smallLayout,
      fonts: renderFonts,
      resources,
      color: 0xffffff,
      styleColors: { foreground: 0x00ff66 },
      outline: { width: 0.025, color: 0xff3d81 },
      shadow: {
        offsetX: 0.02,
        offsetY: -0.025,
        softness: 0.015,
        color: 0x44aaff,
        opacity: 0.8,
      },
    })
    const large = new Text({
      layout: largeLayout,
      fonts: renderFonts,
      resources,
      color: 0xffffff,
      styleColors: { foreground: 0x00ff66 },
      lit: true,
      outline: { width: 0.025, color: 0xff3d81 },
      shadow: {
        offsetX: 0.02,
        offsetY: -0.025,
        softness: 0.015,
        color: 0x44aaff,
        opacity: 0.8,
      },
    })
    small.position.y = 0.55
    large.position.y = -0.55
    large.castShadow = true
    await Promise.all([small.sync(), large.sync()])
    const sdfMetadata = small.geometry.getAttribute('glyphSdf')
    const eligibleInstances = Array.from({ length: small.geometry.instanceCount }, (_, index) =>
      sdfMetadata.getZ(index),
    )
    expect(eligibleInstances).toContain(0)
    expect(eligibleInstances).toContain(1)
    const callsAfterFirst = outlineCalls.emoji + outlineCalls.latin
    const borrower = new Text({ layout: smallLayout, fonts: renderFonts, resources })
    await borrower.sync()
    const callsAfterBorrower = outlineCalls.emoji + outlineCalls.latin
    expect(callsAfterBorrower).toBe(callsAfterFirst)
    expect(borrower.geometry.getAttribute('glyphSlot').array).toEqual(
      small.geometry.getAttribute('glyphSlot').array,
    )

    const acceptedLayout = small.layoutResult
    small.fonts = new Map()
    await expect(small.sync()).rejects.toThrow()
    expect(small.layoutResult).toBe(acceptedLayout)
    small.fonts = renderFonts
    await small.sync()

    const ambient = new AmbientLight(0xffffff, 0.7)
    const directional = new DirectionalLight(0xffffff, 2)
    directional.position.set(-2, 2, 3)
    directional.castShadow = true
    scene.add(small, large, ambient, directional)
    renderer.render(scene, camera)
    await Promise.resolve()
    const image = await capture(renderer)
    const pixelEvidence = semantics(image)
    expect(pixelEvidence.opaque).toBeGreaterThan(300)
    expect(pixelEvidence.transparent).toBeGreaterThan(WIDTH * HEIGHT * 0.7)
    expect(pixelEvidence.chromatic).toBeGreaterThan(100)
    expect(pixelEvidence.semiTransparent).toBeGreaterThan(100)
    expect(pixelEvidence.boundedAlpha).toBe(true)

    await record({
      schemaVersion: '1',
      kind: 'actual-webgpu-colr-v0',
      environment: { node: 'browser', platform: navigator.platform },
      evidence: [
        { source: emojiUrl.pathname, integrity: 'fixture-manifest-sha256' },
        { source: latinUrl.pathname, integrity: 'harfbuzz-validation fixture' },
      ],
      three: '0.185.1',
      browser: navigator.userAgent,
      adapter: {
        architecture: adapter.info.architecture,
        description: adapter.info.description,
        device: adapter.info.device,
        vendor: adapter.info.vendor,
      },
      backend: 'WebGPU',
      layoutGlyphs: { small: smallLayout.glyphs.length, large: largeLayout.glyphs.length },
      renderedLayerInstances: {
        unlit: small.geometry.instanceCount,
        lit: large.geometry.instanceCount,
      },
      materialVariants: ['unlit', 'planar-lit'],
      paints: ['CPAL palette zero', 'current foreground', 'CPAL alpha 96/255'],
      ordinarySdfPaint: {
        outline: { width: 0.025, color: '#ff3d81' },
        shadow: { offset: [0.02, -0.025], softness: 0.015, color: '#44aaff' },
        eligibleInstances: eligibleInstances.filter((value) => value === 1).length,
        colrLayerInstances: eligibleInstances.filter((value) => value === 0).length,
        boundary: 'ordinary glyphs receive SDF paint; COLR layers remain unchanged',
      },
      outlineCallsAfterFirst: callsAfterFirst,
      outlineCallsAfterSharedBorrower: callsAfterBorrower,
      semanticPixels: pixelEvidence,
      updateRecovery: 'failed missing-font update preserved the accepted layout and recovered',
      lifecycle: 'renderer resources disposed idempotently; caller fonts remain caller-owned',
    })

    let disposed = false
    const dispose = () => {
      if (disposed) return
      disposed = true
      scene.clear()
      small.dispose()
      large.dispose()
      borrower.dispose()
      resources.dispose()
      directional.dispose()
      renderer.dispose()
      emoji.dispose()
      latin.dispose()
    }
    disposers.push(dispose)
    dispose()
    disposers.pop()
  })
})

import { type FontHandle, loadFont } from '@webgpu-text/font'
import type { ResolvedLayoutInput } from '@webgpu-text/layout'
import { Text } from '@webgpu-text/three'
import { Color, OrthographicCamera, Scene, WebGPURenderer } from 'three/webgpu'

function resolveSingleRun(font: FontHandle, text: string, fontSize: number): ResolvedLayoutInput {
  const shaped = font.shape({ text, direction: 'ltr', script: 'Latn', language: 'en' })
  const scale = fontSize / font.facts.unitsPerEm
  const metrics = {
    ascender: font.facts.ascender * scale,
    descender: font.facts.descender * scale,
    lineGap: font.facts.lineGap * scale,
  }
  return {
    text,
    paragraphLevel: 0,
    defaultMetrics: metrics,
    maxWidth: null,
    whiteSpace: 'normal',
    overflowWrap: 'normal',
    textAlign: 'left',
    textIndent: 0,
    letterSpacing: 0,
    lineHeight: 'normal',
    anchorX: 'center',
    anchorY: 'middle',
    runs: [
      {
        start: 0,
        end: text.length,
        direction: shaped.direction,
        bidiLevel: 0,
        script: shaped.script,
        language: shaped.language,
        styleKey: 'default',
        fontKey: 'body',
        fontSize,
        metrics,
        variations: shaped.variations,
        glyphs: shaped.glyphs.map((glyph) => ({
          start: glyph.clusterStart,
          end: glyph.clusterEnd,
          glyphId: glyph.glyphId,
          xAdvance: glyph.xAdvance * scale,
          yAdvance: glyph.yAdvance * scale,
          xOffset: glyph.xOffset * scale,
          yOffset: glyph.yOffset * scale,
          flags: glyph.flags,
          bounds: null,
        })),
      },
    ],
  }
}

async function start(canvas: HTMLCanvasElement) {
  if (!navigator.gpu) throw new Error('This example requires WebGPU')
  const response = await fetch('/fonts/NotoSans-Regular.ttf')
  if (!response.ok) throw new Error(`Unable to fetch font: ${response.status}`)
  const font = await loadFont(await response.arrayBuffer())
  const renderer = new WebGPURenderer({ canvas, antialias: true })
  renderer.setPixelRatio(devicePixelRatio)
  renderer.setSize(canvas.clientWidth || 800, canvas.clientHeight || 300, false)
  await renderer.init()
  const scene = new Scene()
  scene.background = new Color(0x101820)
  const camera = new OrthographicCamera(-2, 2, 0.75, -0.75, 0.1, 10)
  camera.position.z = 3
  const text = new Text({
    input: resolveSingleRun(font, 'WebGPU Text', 0.45),
    fonts: new Map([['body', font]]),
    color: 0x55d8ff,
  })
  await text.sync()
  scene.add(text)
  renderer.render(scene, camera)
  return () => {
    scene.remove(text)
    text.dispose()
    font.dispose()
    renderer.dispose()
  }
}

const canvas = document.querySelector<HTMLCanvasElement>('#text')
if (!canvas) throw new Error('Missing #text canvas')
const dispose = await start(canvas)
window.addEventListener('pagehide', dispose, { once: true })

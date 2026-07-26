'use client'

import {
  type ColorGlyphPaint,
  type GlyphOutline,
  OutlineCommand,
} from '@text-rendering-toolkit/font'
import { useEffect, useMemo, useRef, useState } from 'react'
import { errorMessage } from './demo-fonts'
import { ExampleFrame } from './example-frame'
import { useDemoFonts } from './use-demo-fonts'

const EMOJI = ['😀', '✍', '✍🏽', '❤', '👨‍👩‍👧', '👩‍💻', '🇺🇸'] as const
const FOREGROUND = '#55ff99'

interface DrawableLayer {
  readonly glyphId: number
  readonly color: ColorGlyphPaint
  readonly outline: GlyphOutline
}

export function ColorGlyphExampleClient() {
  const [emoji, setEmoji] = useState<(typeof EMOJI)[number]>('😀')
  const [zoom, setZoom] = useState(1)
  const [showOutlines, setShowOutlines] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fontState = useDemoFonts()
  const model = useMemo(() => {
    if (fontState.status !== 'ready') return undefined
    try {
      const font = fontState.value.fonts.get('emoji')
      if (!font) throw new Error('The color demo font is unavailable')
      const run = font.shape({
        text: emoji,
        direction: 'ltr',
        script: 'Zyyy',
        language: 'und',
      })
      const glyph = run.glyphs[0]
      if (!glyph || run.glyphs.length !== 1) throw new Error('Expected one shaped emoji glyph')
      const colorLayers = font.getColorLayers(glyph.glyphId)
      const layers: readonly DrawableLayer[] = (
        colorLayers ?? [{ glyphId: glyph.glyphId, color: 'foreground' as const }]
      ).map((layer) => ({ ...layer, outline: font.getOutline(layer.glyphId) }))
      return { status: 'ready' as const, glyphId: glyph.glyphId, layers }
    } catch (error) {
      return { status: 'error' as const, error: errorMessage(error) }
    }
  }, [emoji, fontState])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || model?.status !== 'ready') return
    paintLayers(canvas, model.layers, FOREGROUND, showOutlines, zoom)
  }, [model, showOutlines, zoom])

  const error = fontState.status === 'error' ? fontState.message : model?.error
  return (
    <ExampleFrame
      title="COLR v0 layer explorer"
      status={fontState.status === 'loading' ? 'Loading font bytes…' : 'CPU canvas · no WebGPU'}
      error={error}
    >
      {model?.status === 'ready' ? (
        <div className="grid items-start gap-5 md:grid-cols-[minmax(0,20rem)_1fr]">
          <canvas
            aria-label={`${emoji} rendered from ${model.layers.length} ordered COLR layers`}
            className="aspect-square w-full rounded-lg border"
            height={320}
            ref={canvasRef}
            role="img"
            style={{
              backgroundColor: '#eef0f3',
              backgroundImage:
                'linear-gradient(45deg, #d8dbe0 25%, transparent 25%), linear-gradient(-45deg, #d8dbe0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d8dbe0 75%), linear-gradient(-45deg, transparent 75%, #d8dbe0 75%)',
              backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
              backgroundSize: '16px 16px',
            }}
            width={320}
          />

          <div className="grid gap-4">
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">Glyph</legend>
              <div className="flex flex-wrap gap-2">
                {EMOJI.map((value) => (
                  <button
                    aria-pressed={emoji === value}
                    className="rounded-lg border bg-fd-background px-3 py-2 text-xl aria-pressed:border-fd-primary aria-pressed:bg-fd-accent"
                    key={value}
                    onClick={() => setEmoji(value)}
                    type="button"
                  >
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <label className="grid gap-1 font-medium">
                Zoom · {zoom.toFixed(1)}×
                <input
                  max="1.3"
                  min="0.7"
                  onChange={(event) => setZoom(Number(event.target.value))}
                  step="0.1"
                  type="range"
                  value={zoom}
                />
              </label>
              <label className="flex items-center gap-2 font-medium">
                <input
                  checked={showOutlines}
                  onChange={(event) => setShowOutlines(event.target.checked)}
                  type="checkbox"
                />
                Show layer outlines
              </label>
            </div>

            <div className="text-sm text-fd-muted-foreground">
              Base glyph {model.glyphId} · {model.layers.length} ordered layers
            </div>
            <ol className="grid max-h-48 gap-2 overflow-auto text-xs">
              {model.layers.map((layer, index) => (
                <li
                  key={`${layer.glyphId}:${paintColor(layer.color, FOREGROUND)}`}
                  className="flex items-center justify-between gap-3 rounded-lg bg-fd-muted px-3 py-2"
                >
                  <span>
                    Layer {index + 1} · glyph {layer.glyphId}
                  </span>
                  <span className="flex items-center gap-2 font-mono">
                    <span
                      className="size-4 rounded-full border"
                      style={{ background: paintColor(layer.color, FOREGROUND) }}
                    />
                    {layer.color === 'foreground'
                      ? 'foreground'
                      : `rgba(${layer.color.red}, ${layer.color.green}, ${layer.color.blue}, ${layer.color.alpha})`}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}
    </ExampleFrame>
  )
}

function paintColor(color: ColorGlyphPaint, foreground: string): string {
  if (color === 'foreground') return foreground
  return `rgb(${color.red} ${color.green} ${color.blue} / ${color.alpha / 255})`
}

function paintLayers(
  canvas: HTMLCanvasElement,
  layers: readonly DrawableLayer[],
  foreground: string,
  showOutlines: boolean,
  zoom: number,
): void {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser does not provide a 2D canvas context')
  const bounds = layers.reduce(
    (result, layer) => ({
      xMin: Math.min(result.xMin, layer.outline.bounds.xMin),
      yMin: Math.min(result.yMin, layer.outline.bounds.yMin),
      xMax: Math.max(result.xMax, layer.outline.bounds.xMax),
      yMax: Math.max(result.yMax, layer.outline.bounds.yMax),
    }),
    {
      xMin: Number.POSITIVE_INFINITY,
      yMin: Number.POSITIVE_INFINITY,
      xMax: Number.NEGATIVE_INFINITY,
      yMax: Number.NEGATIVE_INFINITY,
    },
  )
  const width = bounds.xMax - bounds.xMin
  const height = bounds.yMax - bounds.yMin
  if (!(width > 0) || !(height > 0)) throw new Error('Color glyph has no drawable bounds')
  const padding = 28
  const scale =
    Math.min((canvas.width - padding * 2) / width, (canvas.height - padding * 2) / height) * zoom
  const centerX = (bounds.xMin + bounds.xMax) / 2
  const centerY = (bounds.yMin + bounds.yMax) / 2
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.setTransform(
    scale,
    0,
    0,
    -scale,
    canvas.width / 2 - centerX * scale,
    canvas.height / 2 + centerY * scale,
  )
  for (const layer of layers) {
    const path = outlinePath(layer.outline)
    context.fillStyle = paintColor(layer.color, foreground)
    context.fill(path)
    if (showOutlines) {
      context.lineWidth = 1 / scale
      context.strokeStyle = 'rgb(0 0 0 / 0.55)'
      context.stroke(path)
    }
  }
}

function outlinePath(outline: GlyphOutline): Path2D {
  const path = new Path2D()
  let offset = 0
  const coordinate = () => {
    const value = outline.coordinates[offset]
    if (value === undefined) throw new Error('Glyph outline coordinate is missing')
    offset += 1
    return value
  }
  for (const command of outline.commands) {
    if (command === OutlineCommand.MOVE_TO) path.moveTo(coordinate(), coordinate())
    else if (command === OutlineCommand.LINE_TO) path.lineTo(coordinate(), coordinate())
    else if (command === OutlineCommand.QUADRATIC_TO) {
      path.quadraticCurveTo(coordinate(), coordinate(), coordinate(), coordinate())
    } else if (command === OutlineCommand.CUBIC_TO) {
      path.bezierCurveTo(
        coordinate(),
        coordinate(),
        coordinate(),
        coordinate(),
        coordinate(),
        coordinate(),
      )
    } else if (command === OutlineCommand.CLOSE_PATH) path.closePath()
    else throw new Error(`Unknown outline command: ${command}`)
  }
  return path
}

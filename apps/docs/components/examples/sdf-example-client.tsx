'use client'

import { layoutText } from '@webgpu-text/layout'
import { generateSdf, type SdfBitmap } from '@webgpu-text/sdf'
import { useEffect, useMemo, useRef, useState } from 'react'
import { errorMessage } from './demo-fonts'
import { ExampleFrame } from './example-frame'
import { sdfPixelsToCoverageRgba, sdfPixelsToRgba } from './sdf-bitmap'
import { useDemoFonts } from './use-demo-fonts'

const GLYPHS = ['A', 'g', 'م'] as const
const RESOLUTIONS = [32, 64, 128] as const

export function SdfExampleClient() {
  const [character, setCharacter] = useState<(typeof GLYPHS)[number]>('A')
  const [resolution, setResolution] = useState<(typeof RESOLUTIONS)[number]>(128)
  const [softness, setSoftness] = useState(16)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const shapeCanvasRef = useRef<HTMLCanvasElement>(null)
  const fontState = useDemoFonts()
  const model = useMemo(() => {
    if (fontState.status !== 'ready') return undefined
    try {
      const layout = layoutText(
        {
          text: character,
          style: {
            key: 'preview',
            fontKeys: ['latin', 'arabic'],
            fontSize: 64,
            language: 'und',
          },
        },
        fontState.value.fonts,
      )
      const glyph = layout.glyphs[0]
      if (!glyph) throw new Error('The selected character produced no glyph')
      const font = fontState.value.fonts.get(glyph.fontKey)
      if (!font) throw new Error(`Missing selected font: ${glyph.fontKey}`)
      const outline = font.getOutline(glyph.glyphId, glyph.variations)
      const extent = Math.max(
        outline.bounds.xMax - outline.bounds.xMin,
        outline.bounds.yMax - outline.bounds.yMin,
      )
      if (!(extent > 0)) throw new Error('The selected glyph has no drawable outline')
      const padding = extent * 0.16
      const bitmap = generateSdf({
        outline,
        viewBox: {
          left: outline.bounds.xMin - padding,
          bottom: outline.bounds.yMin - padding,
          right: outline.bounds.xMax + padding,
          top: outline.bounds.yMax + padding,
        },
        width: resolution,
        height: resolution,
        distance: padding,
        exponent: 9,
      })
      return {
        status: 'ready' as const,
        bitmap,
        glyphId: glyph.glyphId,
        fontKey: glyph.fontKey,
      }
    } catch (error) {
      return { status: 'error' as const, error: errorMessage(error) }
    }
  }, [character, fontState, resolution])

  const bitmap = model?.status === 'ready' ? model.bitmap : undefined
  useEffect(() => {
    const canvas = canvasRef.current
    const shapeCanvas = shapeCanvasRef.current
    if (!canvas || !shapeCanvas || !bitmap) return
    paintBitmap(canvas, bitmap, sdfPixelsToRgba(bitmap.pixels, bitmap.width, bitmap.height))
    paintBitmap(
      shapeCanvas,
      bitmap,
      sdfPixelsToCoverageRgba(bitmap.pixels, bitmap.width, bitmap.height, softness),
    )
  }, [bitmap, softness])

  const error = fontState.status === 'error' ? fontState.message : model?.error
  return (
    <ExampleFrame
      title="CPU SDF preview"
      status={fontState.status === 'loading' ? 'Loading font bytes…' : '2D canvas · no GPU'}
      error={error}
    >
      {model?.status === 'ready' ? (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,28rem)_1fr]">
          <div className="grid grid-cols-2 gap-3">
            <figure className="grid gap-2 text-center text-xs text-fd-muted-foreground">
              <canvas
                className="aspect-square w-full rounded-lg border bg-black [image-rendering:pixelated]"
                height={model.bitmap.height}
                ref={canvasRef}
                width={model.bitmap.width}
              />
              <figcaption>Encoded distance</figcaption>
            </figure>
            <figure className="grid gap-2 text-center text-xs text-fd-muted-foreground">
              <canvas
                className="aspect-square w-full rounded-lg border bg-[#101820] [image-rendering:pixelated]"
                height={model.bitmap.height}
                ref={shapeCanvasRef}
                width={model.bitmap.width}
              />
              <figcaption>Filled preview</figcaption>
            </figure>
          </div>
          <div className="grid gap-4">
            <label className="grid gap-2 text-sm font-medium">
              Glyph
              <select
                className="rounded-lg border bg-fd-background p-2"
                onChange={(event) => setCharacter(event.target.value as (typeof GLYPHS)[number])}
                value={character}
              >
                {GLYPHS.map((glyph) => (
                  <option key={glyph} value={glyph}>
                    {glyph}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Resolution
              <select
                className="rounded-lg border bg-fd-background p-2"
                onChange={(event) =>
                  setResolution(Number(event.target.value) as (typeof RESOLUTIONS)[number])
                }
                value={resolution}
              >
                {RESOLUTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value} × {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Edge softness · {softness}
              <input
                max="32"
                min="4"
                onChange={(event) => setSoftness(Number(event.target.value))}
                step="2"
                type="range"
                value={softness}
              />
            </label>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-fd-muted-foreground">Font</dt>
              <dd className="font-mono">{model.fontKey}</dd>
              <dt className="text-fd-muted-foreground">Glyph ID</dt>
              <dd>{model.glyphId}</dd>
              <dt className="text-fd-muted-foreground">Bitmap</dt>
              <dd>
                {model.bitmap.width} × {model.bitmap.height} bytes
              </dd>
            </dl>
          </div>
        </div>
      ) : null}
    </ExampleFrame>
  )
}

function paintBitmap(canvas: HTMLCanvasElement, bitmap: SdfBitmap, rgba: Uint8ClampedArray): void {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser does not provide a 2D canvas context')
  const image = new ImageData(bitmap.width, bitmap.height)
  image.data.set(rgba)
  context.putImageData(image, 0, 0)
}

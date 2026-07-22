'use client'

import { layoutText } from '@webgpu-text/layout'
import { generateSdf, type SdfBitmap } from '@webgpu-text/sdf'
import { useEffect, useMemo, useRef, useState } from 'react'
import { errorMessage } from './demo-fonts'
import { ExampleFrame } from './example-frame'
import { sdfPixelsToRgba } from './sdf-bitmap'
import { useDemoFonts } from './use-demo-fonts'

const GLYPHS = ['A', 'g', 'م'] as const

export function SdfExampleClient() {
  const [character, setCharacter] = useState<(typeof GLYPHS)[number]>('A')
  const canvasRef = useRef<HTMLCanvasElement>(null)
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
        width: 128,
        height: 128,
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
  }, [character, fontState])

  const bitmap = model?.status === 'ready' ? model.bitmap : undefined
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !bitmap) return
    paintBitmap(canvas, bitmap)
  }, [bitmap])

  const error = fontState.status === 'error' ? fontState.message : model?.error
  return (
    <ExampleFrame
      title="CPU SDF preview"
      status={fontState.status === 'loading' ? 'Loading font bytes…' : '2D canvas · no GPU'}
      error={error}
    >
      {model?.status === 'ready' ? (
        <div className="grid items-start gap-5 md:grid-cols-[auto_1fr]">
          <canvas
            className="size-64 max-w-full rounded-lg border bg-black [image-rendering:pixelated]"
            height={model.bitmap.height}
            ref={canvasRef}
            width={model.bitmap.width}
          />
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

function paintBitmap(canvas: HTMLCanvasElement, bitmap: SdfBitmap): void {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser does not provide a 2D canvas context')
  const image = new ImageData(bitmap.width, bitmap.height)
  image.data.set(sdfPixelsToRgba(bitmap.pixels, bitmap.width, bitmap.height))
  context.putImageData(image, 0, 0)
}

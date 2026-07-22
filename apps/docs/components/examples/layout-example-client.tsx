'use client'

import {
  type FontRegistry,
  type LayoutAlignment,
  type LayoutResult,
  layoutPreparedText,
  prepareText,
} from '@webgpu-text/layout'
import { useMemo, useState } from 'react'
import { errorMessage } from './demo-fonts'
import { ExampleFrame } from './example-frame'
import { useDemoFonts } from './use-demo-fonts'

const INITIAL_TEXT = 'Hello مرحبا — WebGPU text wraps here.'

export function LayoutExampleClient() {
  const [text, setText] = useState(INITIAL_TEXT)
  const [maxWidth, setMaxWidth] = useState(360)
  const [textAlign, setTextAlign] = useState<LayoutAlignment>('left')
  const fontState = useDemoFonts()
  const model = useMemo(() => {
    if (fontState.status !== 'ready') return undefined
    try {
      const prepared = prepareText({
        text,
        style: {
          key: 'body',
          fontKeys: ['latin', 'arabic'],
          fontSize: 32,
          language: 'und',
        },
        layout: {
          maxWidth,
          overflowWrap: 'break-word',
          textAlign,
        },
      })
      return {
        status: 'ready' as const,
        fonts: fontState.value.fonts,
        prepared,
        layout: layoutPreparedText(prepared, fontState.value.fonts),
      }
    } catch (error) {
      return { status: 'error' as const, error: errorMessage(error) }
    }
  }, [fontState, maxWidth, text, textAlign])

  const error = fontState.status === 'error' ? fontState.message : model?.error
  return (
    <ExampleFrame
      title="Multilingual layout inspector"
      status={fontState.status === 'loading' ? 'Loading font bytes…' : 'CPU only'}
      error={error}
    >
      {model?.status === 'ready' ? (
        <div className="grid gap-5">
          <label className="grid gap-2 text-sm font-medium">
            Raw text
            <textarea
              className="min-h-24 rounded-lg border bg-fd-background p-3 font-sans text-lg"
              dir="auto"
              onChange={(event) => setText(event.target.value)}
              value={text}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <label className="grid gap-2 text-sm font-medium">
              Maximum width · {maxWidth}px
              <input
                max="720"
                min="180"
                onChange={(event) => setMaxWidth(Number(event.target.value))}
                step="20"
                type="range"
                value={maxWidth}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Alignment
              <select
                className="rounded-lg border bg-fd-background p-2"
                onChange={(event) => setTextAlign(event.target.value as LayoutAlignment)}
                value={textAlign}
              >
                {(['left', 'center', 'right', 'justify'] as const).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <LayoutPreview fonts={model.fonts} layout={model.layout} text={text} />

          <div className="grid gap-3 md:grid-cols-3">
            <Stat label="Segments" value={model.prepared.segments.length} />
            <Stat label="Lines" value={model.layout.lines.length} />
            <Stat label="Glyphs" value={model.layout.glyphs.length} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="text-fd-muted-foreground">
                <tr>
                  <th className="border-b p-2">Source</th>
                  <th className="border-b p-2">Script</th>
                  <th className="border-b p-2">Direction</th>
                  <th className="border-b p-2">Font</th>
                  <th className="border-b p-2">Line</th>
                  <th className="border-b p-2">Position</th>
                </tr>
              </thead>
              <tbody>
                {model.layout.glyphs.slice(0, 48).map((glyph, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: layout glyphs expose no unique instance identifier.
                  <tr key={`${glyph.start}:${glyph.end}:${glyph.glyphId}:${index}`}>
                    <td className="border-b p-2" dir="auto">
                      {text.slice(glyph.start, glyph.end) || '—'}
                    </td>
                    <td className="border-b p-2">
                      {model.prepared.segments.find(
                        (segment) => segment.start <= glyph.start && segment.end >= glyph.end,
                      )?.script ?? '—'}
                    </td>
                    <td className="border-b p-2">
                      {model.prepared.segments.find(
                        (segment) => segment.start <= glyph.start && segment.end >= glyph.end,
                      )?.direction ?? '—'}
                    </td>
                    <td className="border-b p-2 font-mono">{glyph.fontKey}</td>
                    <td className="border-b p-2">{glyph.lineIndex + 1}</td>
                    <td className="border-b p-2 font-mono">
                      {glyph.x.toFixed(1)}, {glyph.y.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </ExampleFrame>
  )
}

function LayoutPreview({
  fonts,
  layout,
  text,
}: {
  readonly fonts: FontRegistry
  readonly layout: LayoutResult
  readonly text: string
}) {
  const { left, bottom, right, top } = layout.blockBounds
  const width = Math.max(1, right - left)
  const height = Math.max(1, top - bottom)
  const padding = Math.max(width, height) * 0.04
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-4 text-xs text-fd-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-cyan-500/60" /> Latin/other outline bounds
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-amber-500/60" /> Arabic outline bounds
        </span>
        <span>Dashed boxes are line metrics</span>
      </div>
      <svg
        aria-label="Positioned glyph and line geometry"
        className="h-64 w-full rounded-lg border bg-[#0b1220]"
        role="img"
        viewBox={`${left - padding} ${-top - padding} ${width + padding * 2} ${height + padding * 2}`}
      >
        {layout.lines.map((line) => (
          <g key={`${line.start}:${line.end}:${line.baseline}`}>
            <rect
              fill="none"
              height={line.top - line.bottom}
              stroke="rgb(148 163 184 / 0.7)"
              strokeDasharray={`${Math.max(width / 100, 2)} ${Math.max(width / 100, 2)}`}
              strokeWidth={Math.max(width / 500, 0.5)}
              width={line.right - line.left}
              x={line.left}
              y={-line.top}
            />
            <line
              stroke="rgb(148 163 184 / 0.45)"
              strokeWidth={Math.max(width / 700, 0.4)}
              x1={line.left}
              x2={line.right}
              y1={-line.baseline}
              y2={-line.baseline}
            />
          </g>
        ))}
        {layout.glyphs.map((glyph) => {
          const outline = fonts.get(glyph.fontKey)?.getOutline(glyph.glyphId, glyph.variations)
          const bounds =
            glyph.bounds ??
            (outline
              ? {
                  left: outline.bounds.xMin * glyph.fontUnitScale,
                  bottom: outline.bounds.yMin * glyph.fontUnitScale,
                  right: outline.bounds.xMax * glyph.fontUnitScale,
                  top: outline.bounds.yMax * glyph.fontUnitScale,
                }
              : null)
          if (!bounds) return null
          const left = glyph.x + glyph.xOffset + bounds.left
          const top = glyph.y + glyph.yOffset + bounds.top
          return (
            <rect
              key={`${glyph.start}:${glyph.end}:${glyph.glyphId}:${glyph.x}:${glyph.y}`}
              fill={glyph.fontKey === 'arabic' ? 'rgb(245 158 11 / 0.62)' : 'rgb(6 182 212 / 0.62)'}
              height={bounds.top - bounds.bottom}
              stroke="rgb(255 255 255 / 0.65)"
              strokeWidth={Math.max(width / 900, 0.35)}
              width={bounds.right - bounds.left}
              x={left}
              y={-top}
            >
              <title>{`${text.slice(glyph.start, glyph.end) || 'empty'} · glyph ${glyph.glyphId} · ${glyph.fontKey}`}</title>
            </rect>
          )
        })}
      </svg>
    </div>
  )
}

function Stat({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="rounded-lg bg-fd-muted px-3 py-2">
      <div className="text-xs text-fd-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  )
}

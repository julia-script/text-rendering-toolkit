'use client'

import { layoutPreparedText, prepareText } from '@webgpu-text/layout'
import { useMemo, useState } from 'react'
import { errorMessage } from './demo-fonts'
import { ExampleFrame } from './example-frame'
import { useDemoFonts } from './use-demo-fonts'

const INITIAL_TEXT = 'Hello مرحبا'

export function LayoutExampleClient() {
  const [text, setText] = useState(INITIAL_TEXT)
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
          maxWidth: 560,
          overflowWrap: 'break-word',
        },
      })
      return {
        status: 'ready' as const,
        prepared,
        layout: layoutPreparedText(prepared, fontState.value.fonts),
      }
    } catch (error) {
      return { status: 'error' as const, error: errorMessage(error) }
    }
  }, [fontState, text])

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

function Stat({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="rounded-lg bg-fd-muted px-3 py-2">
      <div className="text-xs text-fd-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  )
}

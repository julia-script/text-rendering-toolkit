'use client'

import { type GlyphBounds, type GlyphOutline, loadFont, OutlineCommand } from '@webgpu-text/font'
import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { type OutlineGeometry, outlineGeometry } from './outline-path'

interface PositionedGlyph {
  readonly geometry: OutlineGeometry
  readonly highlight: boolean
  readonly sourceText: string
  readonly x: number
  readonly y: number
}

interface SpecimenModel {
  readonly bounds: GlyphBounds
  readonly commands: number
  readonly controls: number
  readonly contours: number
  readonly glyphs: readonly PositionedGlyph[]
  readonly unitsPerEm: number
}

type GlyphState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly model: SpecimenModel }
  | { readonly status: 'error' }

export function LandingGlyph() {
  const [state, setState] = useState<GlyphState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    void loadSpecimen(controller.signal)
      .then((model) => {
        if (!controller.signal.aborted) setState({ status: 'ready', model })
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' })
      })
    return () => controller.abort()
  }, [])

  if (state.status !== 'ready') {
    return (
      <div className="type-specimen specimen-pending" aria-live="polite">
        <span>{state.status === 'loading' ? 'Generating outlines…' : 'Outlines unavailable'}</span>
      </div>
    )
  }

  const { bounds, commands, controls, contours, glyphs, unitsPerEm } = state.model
  const width = bounds.xMax - bounds.xMin
  const height = bounds.yMax - bounds.yMin
  const padding = Math.max(width, height) * 0.06
  const viewBox = `${bounds.xMin - padding} ${-bounds.yMax - padding} ${width + padding * 2} ${height + padding * 2}`
  const nodeSize = unitsPerEm * 0.018

  return (
    <figure
      className="type-specimen live-specimen"
      aria-label={`Live outlines for WebGPU Text: ${glyphs.length} glyphs, ${commands} path commands, ${contours} contours, ${controls} Bézier controls`}
    >
      <div className="specimen-meta">
        <span>LIVE / @webgpu-text/font</span>
        <span>WEBGPU TEXT / NUMERIC OUTLINES</span>
      </div>
      <div className="curve-legend" aria-hidden="true">
        <span>
          <i className="legend-oncurve" /> on-curve
        </span>
        <span>
          <i className="legend-control" /> Bézier control
        </span>
      </div>

      <svg
        className="landing-glyph"
        role="img"
        aria-label="Animated WebGPU Text outlines with curve handles on the letter G"
        viewBox={viewBox}
      >
        <rect
          className="landing-glyph-bounds"
          x={bounds.xMin}
          y={-bounds.yMax}
          width={width}
          height={height}
        />
        {[0, -unitsPerEm * 1.08].map((baseline) => (
          <line
            className="landing-glyph-guide"
            key={baseline}
            x1={bounds.xMin - padding}
            x2={bounds.xMax + padding}
            y1={-baseline}
            y2={-baseline}
          />
        ))}
        <g transform="scale(1 -1)">
          {glyphs.map((glyph, index) => (
            <g
              // biome-ignore lint/suspicious/noArrayIndexKey: shaped glyph instances expose no unique identifier.
              key={index}
              transform={`translate(${glyph.x} ${glyph.y})`}
            >
              <path
                className="landing-glyph-path"
                d={glyph.geometry.d}
                pathLength="1"
                style={
                  {
                    animationDelay: `${180 + index * 70}ms, ${1350 + index * 70}ms`,
                  } satisfies CSSProperties
                }
              />
              {glyph.highlight ? (
                <g className="landing-curve-map">
                  {glyph.geometry.handles.map((handle, handleIndex) => (
                    <line
                      className="curve-handle-line"
                      // biome-ignore lint/suspicious/noArrayIndexKey: a handle has no identity beyond its outline order.
                      key={`handle:${handleIndex}`}
                      x1={handle.from.x}
                      x2={handle.to.x}
                      y1={handle.from.y}
                      y2={handle.to.y}
                    />
                  ))}
                  {glyph.geometry.endpoints.map((point, pointIndex) => (
                    <rect
                      className="curve-node-oncurve"
                      // biome-ignore lint/suspicious/noArrayIndexKey: a point has no identity beyond its outline order.
                      key={`endpoint:${pointIndex}`}
                      x={point.x - nodeSize / 2}
                      y={point.y - nodeSize / 2}
                      width={nodeSize}
                      height={nodeSize}
                    />
                  ))}
                  {glyph.geometry.controls.map((point, pointIndex) => (
                    <rect
                      className="curve-node-control"
                      // biome-ignore lint/suspicious/noArrayIndexKey: a point has no identity beyond its outline order.
                      key={`control:${pointIndex}`}
                      x={point.x - nodeSize / 2}
                      y={point.y - nodeSize / 2}
                      width={nodeSize}
                      height={nodeSize}
                      transform={`rotate(45 ${point.x} ${point.y})`}
                    />
                  ))}
                </g>
              ) : null}
            </g>
          ))}
        </g>
      </svg>

      <span className="spec-label live-label-cap">aggregate bounds</span>
      <span className="spec-label live-label-base">baselines</span>
      <div className="specimen-stats">
        <Stat label="Glyphs" value={glyphs.length} />
        <Stat label="Path ops" value={commands} />
        <Stat label="Contours" value={contours} />
        <Stat label="Curve controls" value={controls} />
        <Stat label="Units / em" value={unitsPerEm} />
      </div>
    </figure>
  )
}

async function loadSpecimen(signal: AbortSignal): Promise<SpecimenModel> {
  const response = await fetch('/fonts/NotoSans-wdth-wght.ttf', { signal })
  if (!response.ok) throw new Error(`Font request failed: ${response.status}`)
  const font = await loadFont(await response.arrayBuffer())
  try {
    const unitsPerEm = font.facts.unitsPerEm
    const first = shapeWord(font, 'WebGPU', 0, 0)
    const second = shapeWord(font, 'Text', first.advance * 0.34, -unitsPerEm * 1.08)
    const glyphs = [...first.glyphs, ...second.glyphs]
    return {
      bounds: unionBounds(glyphs),
      commands: glyphs.reduce((total, glyph) => total + glyph.commands, 0),
      controls: glyphs.reduce((total, glyph) => total + glyph.geometry.controls.length, 0),
      contours: glyphs.reduce((total, glyph) => total + glyph.contours, 0),
      glyphs: glyphs.map(({ commands: _commands, contours: _contours, ...glyph }) => glyph),
      unitsPerEm,
    }
  } finally {
    font.dispose()
  }
}

function shapeWord(
  font: Awaited<ReturnType<typeof loadFont>>,
  text: string,
  originX: number,
  baseline: number,
) {
  const run = font.shape({ text, direction: 'ltr', script: 'Latn', language: 'en' })
  let penX = originX
  const glyphs = run.glyphs.map((glyph) => {
    const outline = font.getOutline(glyph.glyphId, run.variations)
    const positioned = {
      bounds: outline.bounds,
      commands: outline.commands.length,
      contours: countCommand(outline, OutlineCommand.MOVE_TO),
      geometry: outlineGeometry(outline),
      highlight: glyph.sourceText === 'G',
      sourceText: glyph.sourceText,
      x: penX + glyph.xOffset,
      y: baseline + glyph.yOffset,
    }
    penX += glyph.xAdvance
    return positioned
  })
  return { advance: penX - originX, glyphs }
}

function unionBounds(
  glyphs: readonly {
    readonly bounds: GlyphBounds
    readonly x: number
    readonly y: number
  }[],
): GlyphBounds {
  return glyphs.reduce<GlyphBounds>(
    (bounds, glyph) => ({
      xMin: Math.min(bounds.xMin, glyph.x + glyph.bounds.xMin),
      yMin: Math.min(bounds.yMin, glyph.y + glyph.bounds.yMin),
      xMax: Math.max(bounds.xMax, glyph.x + glyph.bounds.xMax),
      yMax: Math.max(bounds.yMax, glyph.y + glyph.bounds.yMax),
    }),
    {
      xMin: Number.POSITIVE_INFINITY,
      yMin: Number.POSITIVE_INFINITY,
      xMax: Number.NEGATIVE_INFINITY,
      yMax: Number.NEGATIVE_INFINITY,
    },
  )
}

function countCommand(outline: GlyphOutline, expected: OutlineCommand): number {
  let count = 0
  for (const command of outline.commands) if (command === expected) count += 1
  return count
}

function Stat({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div>
      <strong>{value.toLocaleString()}</strong>
      <span>{label}</span>
    </div>
  )
}

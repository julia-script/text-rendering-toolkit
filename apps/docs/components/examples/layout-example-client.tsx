'use client'

import {
  type ColorGlyphPaint,
  type GlyphOutline,
  OutlineCommand,
} from '@text-rendering-toolkit/font'
import {
  type DecorationKind,
  type DecorationSegment,
  type DecorationStyle,
  deriveTextDecorations,
  type FontRegistry,
  type LayoutAlignment,
  type LayoutResult,
  layoutPreparedText,
  prepareText,
} from '@text-rendering-toolkit/layout'
import { useId, useMemo, useState } from 'react'
import { errorMessage } from './demo-fonts'
import { ExampleFrame } from './example-frame'
import { useDemoFonts } from './use-demo-fonts'

const INITIAL_TEXT = 'Hello مرحبا 😀 — Text layout wraps naturally here.'
const OVERLAY_TOGGLES = [
  ['glyphs', 'Glyphs'],
  ['bounds', 'Glyph bounds'],
  ['lineBoxes', 'Line boxes'],
  ['baselines', 'Baselines'],
  ['maxWidth', 'Max width'],
  ['metrics', 'Line metrics'],
  ['decorations', 'Decorations'],
] as const
type OverlayKey = (typeof OVERLAY_TOGGLES)[number][0]

export function LayoutExampleClient() {
  const [text, setText] = useState(INITIAL_TEXT)
  const [maxWidth, setMaxWidth] = useState(360)
  const [lineHeight, setLineHeight] = useState(48)
  const [textAlign, setTextAlign] = useState<LayoutAlignment>('left')
  const fontState = useDemoFonts()
  const model = useMemo(() => {
    if (fontState.status !== 'ready') return undefined
    try {
      const prepared = prepareText({
        text,
        style: {
          key: 'body',
          fontKeys: ['latin', 'arabic', 'emoji'],
          fontSize: 32,
          language: 'und',
        },
        layout: {
          lineHeight,
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
  }, [fontState, lineHeight, maxWidth, text, textAlign])

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

          <div className="grid gap-4 sm:grid-cols-2">
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
              Line height · {lineHeight}px
              <input
                max="72"
                min="36"
                onChange={(event) => setLineHeight(Number(event.target.value))}
                step="2"
                type="range"
                value={lineHeight}
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

          <LayoutPreview
            fonts={model.fonts}
            layout={model.layout}
            maxWidth={maxWidth}
            text={text}
          />

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
  maxWidth,
  text,
}: {
  readonly fonts: FontRegistry
  readonly layout: LayoutResult
  readonly maxWidth: number
  readonly text: string
}) {
  const skipInkMaskId = useId().replaceAll(':', '')
  const [visible, setVisible] = useState<Record<OverlayKey, boolean>>({
    glyphs: true,
    bounds: true,
    lineBoxes: true,
    baselines: true,
    maxWidth: true,
    metrics: true,
    decorations: true,
  })
  const [decorationKind, setDecorationKind] = useState<DecorationKind>('underline')
  const [decorationStyle, setDecorationStyle] = useState<DecorationStyle>('wavy')
  const [decorationColor, setDecorationColor] = useState('#38bdf8')
  const [automaticMetrics, setAutomaticMetrics] = useState(true)
  const [decorationThickness, setDecorationThickness] = useState(2)
  const [decorationOffset, setDecorationOffset] = useState(-4)
  const [skipInk, setSkipInk] = useState(true)
  const effectiveStyle = decorationKind === 'strikethrough' ? 'solid' : decorationStyle
  const decorations = useMemo(
    () =>
      deriveTextDecorations(
        layout,
        text.length === 0
          ? []
          : [
              {
                start: 0,
                end: text.length,
                kind: decorationKind,
                style: effectiveStyle,
                color: hexColor(decorationColor),
                thickness: automaticMetrics ? 'auto' : decorationThickness,
                offset: automaticMetrics ? 'auto' : decorationOffset,
                skipInk: skipInk ? 'auto' : 'none',
              },
            ],
      ),
    [
      automaticMetrics,
      decorationColor,
      decorationKind,
      decorationOffset,
      decorationThickness,
      effectiveStyle,
      layout,
      skipInk,
      text.length,
    ],
  )
  const { left, bottom, right, top } = layout.blockBounds
  const width = Math.max(1, right - left)
  const height = Math.max(1, top - bottom)
  const padding = Math.max(width, height) * 0.04
  const guideOffset = Math.max(10, width * 0.025)
  const viewTop = -top - guideOffset - 8
  const viewBottom = -bottom + padding
  const guideCenter = (left + right) / 2
  const guideGap = Math.max(28, width * 0.1)
  const guideY = -top - guideOffset
  return (
    <div className="grid gap-2">
      <fieldset className="grid gap-3 rounded-lg border bg-fd-muted/30 px-3 py-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <legend className="px-1 font-medium">Text decoration</legend>
        <label className="grid gap-1">
          Kind
          <select
            className="rounded-md border bg-fd-background p-2"
            onChange={(event) => setDecorationKind(event.target.value as DecorationKind)}
            value={decorationKind}
          >
            <option value="underline">Underline</option>
            <option value="strikethrough">Strikethrough</option>
          </select>
        </label>
        <label className="grid gap-1">
          Style
          <select
            className="rounded-md border bg-fd-background p-2 disabled:opacity-60"
            disabled={decorationKind === 'strikethrough'}
            onChange={(event) => setDecorationStyle(event.target.value as DecorationStyle)}
            value={effectiveStyle}
          >
            <option value="solid">Solid</option>
            <option value="dotted">Dotted</option>
            <option value="wavy">Wavy</option>
          </select>
        </label>
        <label className="grid gap-1">
          Independent color
          <input
            className="h-9 w-full rounded-md border bg-fd-background"
            onChange={(event) => setDecorationColor(event.target.value)}
            type="color"
            value={decorationColor}
          />
        </label>
        <div className="grid content-start gap-2 pt-1">
          <label className="flex items-center gap-2">
            <input
              checked={automaticMetrics}
              onChange={(event) => setAutomaticMetrics(event.target.checked)}
              type="checkbox"
            />
            Automatic font metrics
          </label>
          <label className="flex items-center gap-2">
            <input
              checked={skipInk}
              onChange={(event) => setSkipInk(event.target.checked)}
              type="checkbox"
            />
            Skip glyph ink
          </label>
        </div>
        {!automaticMetrics ? (
          <>
            <label className="grid gap-1 lg:col-start-1">
              Thickness · {decorationThickness.toFixed(1)}px
              <input
                max="6"
                min="0.5"
                onChange={(event) => setDecorationThickness(Number(event.target.value))}
                step="0.5"
                type="range"
                value={decorationThickness}
              />
            </label>
            <label className="grid gap-1">
              Baseline offset · {decorationOffset.toFixed(1)}px
              <input
                max="20"
                min="-20"
                onChange={(event) => setDecorationOffset(Number(event.target.value))}
                step="1"
                type="range"
                value={decorationOffset}
              />
            </label>
          </>
        ) : null}
      </fieldset>
      <fieldset className="flex flex-wrap gap-x-4 gap-y-2 rounded-lg border bg-fd-muted/30 px-3 py-2 text-xs">
        <legend className="px-1 font-medium">Show</legend>
        {OVERLAY_TOGGLES.map(([key, label]) => (
          <label className="flex items-center gap-1.5" key={key}>
            <input
              checked={visible[key]}
              onChange={(event) =>
                setVisible((current) => ({ ...current, [key]: event.target.checked }))
              }
              type="checkbox"
            />
            {label}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-4 text-xs text-fd-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-cyan-500/60" /> Latin/other outline bounds
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-amber-500/60" /> Arabic outline bounds
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-violet-500/40" /> Color emoji bounds
        </span>
        <span>Dashed boxes are line boxes</span>
      </div>
      <svg
        aria-label="Positioned glyph and line geometry"
        className="h-64 w-full rounded-lg border bg-[#0b1220]"
        role="img"
        viewBox={`${left - padding} ${viewTop} ${width + padding * 2} ${viewBottom - viewTop}`}
      >
        {skipInk && decorations.segments.length > 0 ? (
          <InkSkipMask
            clearance={Math.max(...decorations.segments.map(({ thickness }) => thickness)) * 0.75}
            fonts={fonts}
            height={viewBottom - viewTop}
            id={skipInkMaskId}
            layout={layout}
            width={width + padding * 2}
            x={left - padding}
            y={viewTop}
          />
        ) : null}
        {visible.maxWidth ? (
          <g fill="none" stroke="rgb(203 213 225 / 0.72)">
            <line
              strokeDasharray="4 4"
              x1={left}
              x2={guideCenter - guideGap / 2}
              y1={guideY}
              y2={guideY}
            />
            <line
              strokeDasharray="4 4"
              x1={guideCenter + guideGap / 2}
              x2={right}
              y1={guideY}
              y2={guideY}
            />
            <line x1={left} x2={left} y1={guideY - 3} y2={guideY + 3} />
            <line x1={right} x2={right} y1={guideY - 3} y2={guideY + 3} />
            <text
              fill="rgb(203 213 225 / 0.82)"
              fontSize={Math.max(7, width / 45)}
              stroke="none"
              textAnchor="middle"
              x={guideCenter}
              y={guideY + 2.5}
            >
              {maxWidth.toFixed(0)}px
            </text>
          </g>
        ) : null}
        {layout.lines.map((line, index) => (
          <g key={`${line.start}:${line.end}:${line.baseline}`}>
            {visible.lineBoxes ? (
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
            ) : null}
            {visible.baselines ? (
              <line
                stroke="rgb(148 163 184 / 0.55)"
                strokeWidth={Math.max(width / 700, 0.4)}
                x1={line.left}
                x2={line.right}
                y1={-line.baseline}
                y2={-line.baseline}
              />
            ) : null}
            {visible.metrics ? (
              <text
                fill="rgb(203 213 225 / 0.78)"
                fontSize={Math.max(6, width / 55)}
                x={line.left + 2}
                y={-line.top + Math.max(7, width / 50)}
              >
                L{index + 1} · {(line.top - line.bottom).toFixed(1)}px high
              </text>
            ) : null}
          </g>
        ))}
        {layout.glyphs.map((glyph) => {
          const font = fonts.get(glyph.fontKey)
          if (!font) return null
          const colorLayers = font.getColorLayers(glyph.glyphId)
          const layers = (
            colorLayers ?? [{ glyphId: glyph.glyphId, color: 'foreground' as const }]
          ).map((layer) => ({
            ...layer,
            outline: font.getOutline(layer.glyphId, glyph.variations),
          }))
          const outlineBounds = layers.reduce(
            (result, layer) => ({
              left: Math.min(result.left, layer.outline.bounds.xMin),
              bottom: Math.min(result.bottom, layer.outline.bounds.yMin),
              right: Math.max(result.right, layer.outline.bounds.xMax),
              top: Math.max(result.top, layer.outline.bounds.yMax),
            }),
            {
              left: Number.POSITIVE_INFINITY,
              bottom: Number.POSITIVE_INFINITY,
              right: Number.NEGATIVE_INFINITY,
              top: Number.NEGATIVE_INFINITY,
            },
          )
          const bounds = glyph.bounds ?? {
            left: outlineBounds.left * glyph.fontUnitScale,
            bottom: outlineBounds.bottom * glyph.fontUnitScale,
            right: outlineBounds.right * glyph.fontUnitScale,
            top: outlineBounds.top * glyph.fontUnitScale,
          }
          const left = glyph.x + glyph.xOffset + bounds.left
          const top = glyph.y + glyph.yOffset + bounds.top
          const source = text.slice(glyph.start, glyph.end)
          return (
            <g key={`${glyph.start}:${glyph.end}:${glyph.glyphId}:${glyph.x}:${glyph.y}`}>
              <title>{`${source || 'empty'} · glyph ${glyph.glyphId} · ${glyph.fontKey}`}</title>
              {visible.bounds ? (
                <rect
                  fill={
                    glyph.fontKey === 'arabic'
                      ? 'rgb(245 158 11 / 0.62)'
                      : glyph.fontKey === 'emoji'
                        ? 'rgb(139 92 246 / 0.28)'
                        : 'rgb(6 182 212 / 0.62)'
                  }
                  height={bounds.top - bounds.bottom}
                  stroke="rgb(255 255 255 / 0.65)"
                  strokeWidth={Math.max(width / 900, 0.35)}
                  width={bounds.right - bounds.left}
                  x={left}
                  y={-top}
                />
              ) : null}
              {visible.glyphs
                ? layers.map((layer) => (
                    <path
                      d={outlinePathData(layer.outline)}
                      fill={colorGlyphPaint(layer.color)}
                      fillOpacity={colorLayers ? 0.74 : 0.34}
                      key={`${layer.glyphId}:${colorGlyphPaint(layer.color)}`}
                      pointerEvents="none"
                      transform={`translate(${glyph.x + glyph.xOffset} ${-(glyph.y + glyph.yOffset)}) scale(${glyph.fontUnitScale} ${-glyph.fontUnitScale})`}
                    />
                  ))
                : null}
            </g>
          )
        })}
        {visible.decorations ? (
          <g mask={skipInk ? `url(#${skipInkMaskId})` : undefined}>
            {decorations.segments.map((segment) => (
              <DecorationSvg
                key={`${segment.sourceStart}:${segment.sourceEnd}:${segment.lineIndex}:${segment.xStart}:${segment.xEnd}:${segment.phase}`}
                segment={segment}
              />
            ))}
          </g>
        ) : null}
      </svg>
      {visible.metrics ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            detail="Layout block"
            label="Block"
            value={`${width.toFixed(1)} × ${height.toFixed(1)}px`}
          />
          <MetricCard
            detail={`${effectiveStyle} ${decorationKind} · ${automaticMetrics ? 'font metrics' : 'numeric metrics'}`}
            label="Decoration"
            value={`${decorations.segments.length} segment${decorations.segments.length === 1 ? '' : 's'}`}
          />
          {layout.lines.map((line, index) => (
            <MetricCard
              detail={`baseline ${line.baseline.toFixed(1)} · ${line.breakAfter} break`}
              key={`${line.start}:${line.end}:${line.baseline}`}
              label={`Line ${index + 1}`}
              value={`${(line.right - line.left).toFixed(1)} × ${(line.top - line.bottom).toFixed(1)}px`}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function InkSkipMask({
  clearance,
  fonts,
  height,
  id,
  layout,
  width,
  x,
  y,
}: {
  readonly clearance: number
  readonly fonts: FontRegistry
  readonly height: number
  readonly id: string
  readonly layout: LayoutResult
  readonly width: number
  readonly x: number
  readonly y: number
}) {
  return (
    <defs>
      <mask
        height={height}
        id={id}
        maskContentUnits="userSpaceOnUse"
        maskUnits="userSpaceOnUse"
        width={width}
        x={x}
        y={y}
      >
        <rect fill="white" height={height} width={width} x={x} y={y} />
        {layout.glyphs.flatMap((glyph) => {
          const font = fonts.get(glyph.fontKey)
          if (!font) return []
          const layers = font.getColorLayers(glyph.glyphId) ?? [
            { glyphId: glyph.glyphId, color: 'foreground' as const },
          ]
          return layers.map((layer) => (
            <path
              d={outlinePathData(font.getOutline(layer.glyphId, glyph.variations))}
              fill="black"
              key={`${glyph.start}:${glyph.end}:${glyph.glyphId}:${glyph.x}:${glyph.y}:${layer.glyphId}:${colorGlyphPaint(layer.color)}`}
              stroke="black"
              strokeLinejoin="round"
              strokeWidth={(clearance * 2) / glyph.fontUnitScale}
              transform={`translate(${glyph.x + glyph.xOffset} ${-(glyph.y + glyph.yOffset)}) scale(${glyph.fontUnitScale} ${-glyph.fontUnitScale})`}
            />
          ))
        })}
      </mask>
    </defs>
  )
}

function DecorationSvg({ segment }: { readonly segment: DecorationSegment }) {
  const color = decorationPaint(segment.color)
  if (segment.style === 'wavy') {
    return (
      <path
        d={wavyPath(segment)}
        fill="none"
        pointerEvents="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={segment.thickness}
      />
    )
  }
  return (
    <line
      pointerEvents="none"
      stroke={color}
      strokeDasharray={segment.style === 'dotted' ? `0 ${segment.wavelength}` : undefined}
      strokeDashoffset={segment.style === 'dotted' ? -segment.phase : undefined}
      strokeLinecap="round"
      strokeWidth={segment.thickness}
      x1={segment.xStart}
      x2={segment.xEnd}
      y1={-segment.y}
      y2={-segment.y}
    />
  )
}

function wavyPath(segment: DecorationSegment): string {
  const step = segment.wavelength / 8
  const points: string[] = []
  for (let x = segment.xStart; x < segment.xEnd; x += step) {
    const y =
      segment.y +
      Math.sin(((x - segment.xStart + segment.phase) / segment.wavelength) * Math.PI * 2) *
        segment.amplitude
    points.push(`${points.length === 0 ? 'M' : 'L'}${x} ${-y}`)
  }
  const endY =
    segment.y +
    Math.sin(((segment.xEnd - segment.xStart + segment.phase) / segment.wavelength) * Math.PI * 2) *
      segment.amplitude
  points.push(`L${segment.xEnd} ${-endY}`)
  return points.join(' ')
}

function hexColor(value: string) {
  return {
    red: Number.parseInt(value.slice(1, 3), 16),
    green: Number.parseInt(value.slice(3, 5), 16),
    blue: Number.parseInt(value.slice(5, 7), 16),
    alpha: 255,
  }
}

function decorationPaint(color: DecorationSegment['color']): string {
  return colorGlyphPaint(color)
}

function MetricCard({
  detail,
  label,
  value,
}: {
  readonly detail: string
  readonly label: string
  readonly value: string
}) {
  return (
    <div className="rounded-lg bg-fd-muted px-3 py-2 text-xs">
      <div className="font-medium">{label}</div>
      <div className="font-mono text-sm">{value}</div>
      <div className="text-fd-muted-foreground">{detail}</div>
    </div>
  )
}

function colorGlyphPaint(color: ColorGlyphPaint): string {
  if (color === 'foreground') return 'white'
  return `rgb(${color.red} ${color.green} ${color.blue} / ${color.alpha / 255})`
}

function outlinePathData(outline: GlyphOutline): string {
  const parts: string[] = []
  let offset = 0
  const coordinate = () => {
    const value = outline.coordinates[offset]
    if (value === undefined) throw new Error('Glyph outline coordinate is missing')
    offset += 1
    return value
  }
  for (const command of outline.commands) {
    if (command === OutlineCommand.MOVE_TO) parts.push(`M${coordinate()} ${coordinate()}`)
    else if (command === OutlineCommand.LINE_TO) parts.push(`L${coordinate()} ${coordinate()}`)
    else if (command === OutlineCommand.QUADRATIC_TO) {
      parts.push(`Q${coordinate()} ${coordinate()} ${coordinate()} ${coordinate()}`)
    } else if (command === OutlineCommand.CUBIC_TO) {
      parts.push(
        `C${coordinate()} ${coordinate()} ${coordinate()} ${coordinate()} ${coordinate()} ${coordinate()}`,
      )
    } else if (command === OutlineCommand.CLOSE_PATH) parts.push('Z')
    else throw new Error(`Unknown outline command: ${command}`)
  }
  return parts.join(' ')
}

function Stat({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="rounded-lg bg-fd-muted px-3 py-2">
      <div className="text-xs text-fd-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  )
}

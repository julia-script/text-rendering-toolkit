import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { loadFont } from '@text-rendering-toolkit/font'
import { generateSdf } from '@text-rendering-toolkit/sdf'

import { planSdfPaint } from './index.js'

const artifacts = fileURLToPath(new URL('../../artifacts/', import.meta.url))
const rgba = (red: number, green: number, blue: number, alpha = 255) => ({
  red,
  green,
  blue,
  alpha,
})

function write(name: string, value: unknown): void {
  mkdirSync(artifacts, { recursive: true })
  writeFileSync(
    new URL(`../../artifacts/${name}`, import.meta.url),
    `${JSON.stringify(value, null, 2)}\n`,
  )
}

const evidence = [
  {
    source: 'test-fixtures/fonts/harfbuzz-validation/fixtures.json',
    integrity: 'pinned repository fixture manifest; OFL font sources',
  },
  {
    source: 'test-fixtures/fonts/color-glyph-validation/fixtures.json',
    integrity: 'reproducible COLR validation fixture manifest',
  },
] as const

const request = {
  outlineWidthPixels: 4,
  shadowOffsetXPixels: 2,
  shadowOffsetYPixels: -2,
  shadowSoftnessPixels: 3,
  fillColor: rgba(54, 92, 180),
  outlineColor: rgba(245, 158, 11),
  shadowColor: rgba(0, 0, 0, 160),
}

write('runtime-inventory.json', {
  schemaVersion: 1,
  kind: 'browser-text-decoration-runtime-inventory',
  evidence,
  layoutResult: {
    useful: ['UTF-16 glyph ranges', 'visual lines', 'carets', 'selection rectangles'],
    missing: ['per-fragment font size', 'underline position', 'underline thickness'],
  },
  fontFacts: {
    exposed: ['unitsPerEm', 'ascender', 'descender', 'lineGap', 'coverageCount', 'axes'],
    missing: ['underlinePosition', 'underlineThickness', 'strikeoutPosition', 'strikeoutSize'],
  },
  sdf: {
    encoding: 'one-channel signed distance, edge at 0.5',
    exponent: 9,
    sizeRange: [16, 512],
    padding: 'max(2, floor(sdfSize / 8)) pixels',
  },
  three: {
    glyphInputs: ['bounds', 'flat atlas slot', 'RGBA color'],
    materialInputs: ['opacity', 'clipRect', 'shared atlas dimensions'],
    resourceKey: ['font object', 'glyph id', 'variations', 'sdfSize'],
    colorLayers: 'COLR v0 layers expand after unchanged layout and reuse ordinary SDF slots',
    synchronization: 'latest-state atomic commit with last-valid-state recovery',
  },
})

write('deterministic-observations.json', {
  schemaVersion: 1,
  kind: 'browser-text-decoration-deterministic-observations',
  evidence,
  corpus: [
    'solid underline',
    'dotted underline',
    'wavy underline',
    'solid strikethrough',
    'independent RGBA and current foreground',
    'partial and adjacent UTF-16 ranges',
    'spaces, trailing spaces, empty lines, hard breaks, soft wraps',
    'Latin descenders, combining marks, Arabic, mixed bidi',
    'mixed fonts and sizes',
    'COLR v0 emoji coexistence',
    'automatic and numeric metrics',
    'fragment-reset phase and clipping',
    'bounds-only, outline-aware, and no-skip comparison',
  ],
  selectedNeutralCandidate: {
    input: 'independent half-open UTF-16 decoration spans over completed LayoutResult',
    fragmentation: 'existing renderer-neutral selection rectangles',
    output: 'immutable analytic visual segments',
    patternPhase: 'reset at each visual fragment; ink cuts retain the original fragment phase',
    color: 'explicit RGBA or current-foreground sentinel, independent from glyph fill',
    ordinaryMetricFallback: 'line-height-derived only when compact font metrics are unavailable',
    skipInk: 'none by default; bounds-only auto is viable; outline-aware auto is deferred',
  },
  metricComparison: {
    retainedLayoutMetrics: 'preferred: deterministic and font-aware without renderer font parsing',
    callerFontFacts: 'insufficient today because public facts omit underline and strikeout metrics',
    explicitOverrides: 'accepted escape hatch, not the only ordinary path',
  },
  nonThreeConsumer: 'analytic segments tessellate to plain Float32Array triangles',
  unchangedLayoutIdentity: ['glyphs', 'lines', 'carets', 'selection rectangles'],
})

write('sdf-paint-observations.json', {
  schemaVersion: 1,
  kind: 'browser-text-decoration-sdf-paint-observations',
  evidence,
  plans: [16, 32, 64, 128].map((sdfSize) => planSdfPaint(request, sdfSize)),
  selectedPolicy: {
    ordinaryPath: 'reuse one glyph SDF and stable atlas slot for fill, outline, and one shadow',
    acceptedWhen: 'outline or shadow extent plus one antialias pixel fits encoded padding',
    excessivePaint:
      'reject with required and available padding; caller may choose larger TextResources',
    bounds: 'expand renderer bounds by outline width and directional shadow extent',
    clipping: 'apply the existing local clip rectangle to the composed paint result',
    colorLayers:
      'underline spans COLR glyphs; first glyph-paint release keeps COLR outline/shadow explicit and may defer composed-silhouette semantics',
    resourceIdentity: ['font object', 'glyph id', 'variations', 'sdfSize'],
    appearanceOnly: ['fill', 'outline', 'shadow colors and controls'],
  },
})

write('candidate-decision.json', {
  schemaVersion: 1,
  kind: 'browser-text-decoration-boundary-decision',
  outcome: 'go',
  neutralDecoration: {
    owner: '@text-rendering-toolkit/layout follow-up',
    representation: 'independent spans resolved to immutable analytic line segments',
    styles: ['solid', 'dotted', 'wavy'],
    color: 'explicit RGBA independent from glyph fill with current-foreground convenience',
    metrics: 'compact renderer-neutral font decoration metrics plus numeric override',
    skipInk: 'none default; bounds-only opt-in; defer outline-aware auto',
  },
  glyphPaint: {
    owner: '@text-rendering-toolkit/three-webgpu follow-up',
    representation: 'one reused SDF with appearance-only outline and one shadow',
    limit: 'paint extent must fit resource padding or synchronization rejects before commit',
    colrV0: 'defer composed-silhouette stroke until a dedicated semantic fixture exists',
  },
  followUps: [
    'implement-renderer-neutral-text-decorations',
    'implement-three-sdf-outline-and-shadow',
  ],
  rejected: [
    'derive decorations inside Three',
    'put decoration color into shaping styles',
    'store dotted or wavy patterns in the glyph atlas',
    'duplicate SDF resources per paint color',
    'force eager outlines for default skip-ink',
  ],
})

async function recordFontPaintMeasurements(): Promise<void> {
  const fixtures = [
    {
      id: 'latin-descender',
      source: '../../../../test-fixtures/fonts/harfbuzz-validation/NotoSans-wdth-wght.ttf',
      text: 'g',
      direction: 'ltr' as const,
      script: 'Latn',
      language: 'en',
    },
    {
      id: 'arabic-joining',
      source: '../../../../test-fixtures/fonts/harfbuzz-validation/NotoSansArabic-wdth-wght.ttf',
      text: 'م',
      direction: 'rtl' as const,
      script: 'Arab',
      language: 'ar',
    },
    {
      id: 'colr-v0-emoji-layer',
      source: '../../../../test-fixtures/fonts/color-glyph-validation/noto-validation-colr-v0.ttf',
      text: '😀',
      direction: 'ltr' as const,
      script: 'Zyyy',
      language: 'und',
    },
  ]
  const measurements = []
  for (const fixture of fixtures) {
    const font = await loadFont(
      new Uint8Array(readFileSync(new URL(fixture.source, import.meta.url))),
    )
    try {
      const shaped = font.shape({
        text: fixture.text,
        direction: fixture.direction,
        script: fixture.script,
        language: fixture.language,
      })
      const baseGlyphId = shaped.glyphs[0]?.glyphId
      if (baseGlyphId === undefined) throw new Error(`${fixture.id} produced no glyph`)
      const colorLayers = font.getColorLayers(baseGlyphId)
      const outlineGlyphId = colorLayers?.[0]?.glyphId ?? baseGlyphId
      const outline = font.getOutline(outlineGlyphId)
      const extent = Math.max(
        outline.bounds.xMax - outline.bounds.xMin,
        outline.bounds.yMax - outline.bounds.yMin,
      )
      const sizes = [32, 64, 128].map((sdfSize) => {
        const paddingPixels = Math.max(2, Math.floor(sdfSize / 8))
        const unitsPerPixel = extent / (sdfSize - paddingPixels * 2)
        const viewExtent = unitsPerPixel * sdfSize
        const centerX = (outline.bounds.xMin + outline.bounds.xMax) / 2
        const centerY = (outline.bounds.yMin + outline.bounds.yMax) / 2
        const bitmap = generateSdf({
          outline,
          viewBox: {
            left: centerX - viewExtent / 2,
            bottom: centerY - viewExtent / 2,
            right: centerX + viewExtent / 2,
            top: centerY + viewExtent / 2,
          },
          width: sdfSize,
          height: sdfSize,
          distance: unitsPerPixel * paddingPixels,
          exponent: 9,
        })
        const distinctBytes = new Set(bitmap.pixels)
        return {
          sdfSize,
          paddingPixels,
          unitsPerPixel,
          distanceUnits: bitmap.distance,
          distinctEncodedBytes: distinctBytes.size,
          transitionPixels: bitmap.pixels.filter((value) => value > 0 && value < 255).length,
          insidePixels: bitmap.pixels.filter((value) => value >= 128).length,
          outsidePixels: bitmap.pixels.filter((value) => value < 128).length,
          paintPlan: planSdfPaint(request, sdfSize),
        }
      })
      measurements.push({
        id: fixture.id,
        source: fixture.source.replace('../../../../', ''),
        text: fixture.text,
        baseGlyphId,
        outlineGlyphId,
        colorLayerCount: colorLayers?.length ?? 0,
        outlineBounds: outline.bounds,
        sizes,
      })
    } finally {
      font.dispose()
    }
  }
  write('font-paint-measurements.json', {
    schemaVersion: 1,
    kind: 'browser-text-decoration-font-paint-measurements',
    evidence,
    measurements,
    interpretation:
      '64px is the first tested default that accepts the representative 4px outline plus 2px offset and 3px softness; 32px and smaller reject before commit.',
  })
}

recordFontPaintMeasurements().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})

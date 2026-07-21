# `@webgpu-text/layout`

Pure, renderer-neutral layout of already resolved and shaped text runs. The
package is strict TypeScript and ESM-only. It has no font fetching, automatic
font selection, outline extraction, SDF, atlas, worker, DOM, GPU, or Three.js
runtime behavior.

## Usage

```ts
import { getSelectionRects, layoutResolvedText } from '@webgpu-text/layout'
import type { ResolvedLayoutInput } from '@webgpu-text/layout'

const input: ResolvedLayoutInput = {
  text: 'Hi',
  paragraphLevel: 0,
  defaultMetrics: { ascender: 8, descender: -2, lineGap: 2 },
  maxWidth: 80,
  whiteSpace: 'normal',
  overflowWrap: 'normal',
  textAlign: 'left',
  textIndent: 0,
  letterSpacing: 0,
  lineHeight: 'normal',
  anchorX: 'left',
  anchorY: 'top-baseline',
  runs: [
    {
      start: 0,
      end: 2,
      direction: 'ltr',
      bidiLevel: 0,
      script: 'Latn',
      language: 'en',
      styleKey: 'body',
      fontKey: 'inter',
      fontSize: 10,
      metrics: { ascender: 8, descender: -2, lineGap: 2 },
      variations: {},
      glyphs: [
        { glyphId: 43, start: 0, end: 1, xAdvance: 7, yAdvance: 0, xOffset: 0, yOffset: 0, flags: 0, bounds: null },
        { glyphId: 76, start: 1, end: 2, xAdvance: 3, yAdvance: 0, xOffset: 0, yOffset: 0, flags: 0, bounds: null },
      ],
    },
  ],
}

const result = layoutResolvedText(input)
const selection = getSelectionRects(result, { start: 0, end: 1 })
```

All source ranges are half-open JavaScript UTF-16 indices. Inputs are validated
before layout and are never mutated. Invalid ranges, unresolved text, invalid
bidi levels, non-finite measurements, and inconsistent glyph clusters throw
`InvalidLayoutInputError`.

## Resolved-run boundary

`layoutResolvedText()` deliberately starts after font acquisition, font
selection, fallback, script/direction itemization, and shaping. The application
obtains font bytes by any mechanism it chooses, passes those bytes to
`@webgpu-text/font`, and translates shaped runs into `ResolvedShapedRun`
values. Neither core package accepts a URL or calls `fetch`.

Font facts and shaped glyph measurements are in font units. Scale them exactly
once before layout:

```ts
const scale = fontSize / font.facts.unitsPerEm
const metrics = {
  ascender: font.facts.ascender * scale,
  descender: font.facts.descender * scale,
  lineGap: font.facts.lineGap * scale,
}

const glyphs = shaped.glyphs.map((glyph) => ({
  glyphId: glyph.glyphId,
  start: glyph.clusterStart,
  end: glyph.clusterEnd,
  xAdvance: glyph.xAdvance * scale,
  yAdvance: glyph.yAdvance * scale,
  xOffset: glyph.xOffset * scale,
  yOffset: glyph.yOffset * scale,
  flags: glyph.flags,
  bounds: null,
}))
```

Every measurement supplied to the layout package—advances, offsets, metrics,
optional glyph bounds, width, indentation, spacing, and explicit line
height—must already use the same effective layout-unit coordinate system.
`fontSize` is stable metadata; the layout function does not use it to perform
hidden scaling. Keeping `bounds` as `null` avoids outline work and produces a
`null` `visibleBounds`; consumers can obtain and scale outlines lazily when a
renderer actually needs them.

## Supported policy

- CRLF, CR, and LF hard breaks with original UTF-16 indices
- normal whitespace wrapping, no-wrap overflow, and grapheme-safe
  `break-word` fallback
- left, center, right, and eligible-whitespace justification
- resolved bidi-level visual placement without reversing HarfBuzz's
  direction-local glyph order
- mixed run metrics, indentation, letter spacing, normal or explicit line
  height, and numeric/keyword/percentage anchors
- block and optional visible bounds, logical caret stops, and pure selection
  rectangles

The package does not yet perform Unicode script or bidi itemization, automatic
font fallback, or reshaping around a chosen line break. Soft wrapping currently
uses the accepted whitespace policy rather than the complete Unicode line
breaking algorithm. Bidi caret affinity at ambiguous visual boundaries and
worker adapters are also follow-up capabilities.

The normative fixture corpus and implementation handoff are documented in
[`docs/validation/layout-policy.md`](../../docs/validation/layout-policy.md).

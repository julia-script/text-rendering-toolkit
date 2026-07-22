# `@webgpu-text/layout`

Pure, renderer-neutral preparation and layout of raw text or already resolved
shaped runs. The package is strict TypeScript and ESM-only. It has no font
fetching, eager outline extraction, SDF, atlas, worker, DOM, GPU, or Three.js
runtime behavior.

## Raw-text usage

Applications acquire font bytes however they want and keep ownership of every
`FontHandle`. The layout package only receives an explicit key-to-handle map:

```ts
import { loadFont } from '@webgpu-text/font'
import {
  getSelectionRects,
  layoutPreparedText,
  layoutText,
  prepareText,
} from '@webgpu-text/layout'

const latin = await loadFont(latinBytes)
const arabic = await loadFont(arabicBytes)
const fonts = new Map([
  ['latin', latin],
  ['arabic', arabic],
])

const input = {
  text: 'Hello مرحبا',
  style: {
    key: 'body',
    fontKeys: ['latin', 'arabic'],
    fontSize: 24,
    language: 'und',
  },
  layout: { maxWidth: 320 },
} as const

const prepared = prepareText(input)
const result = layoutPreparedText(prepared, fonts)
const selection = getSelectionRects(result, { start: 0, end: 5 })

// Equivalent convenience path when preparation will not be reused:
const sameResult = layoutText(input, fonts)
```

`prepareText()` performs only grapheme, bidi, script, style, layout-policy, and
default Unicode line-break analysis. Its schema-version-2, deeply frozen
`PreparedText` result contains JSON data, including ordered UTF-16
`breakOpportunities`, so it can
be serialized, stored, or transferred and later reused with a structurally
equivalent caller registry. `layoutPreparedText()` validates parsed values,
selects the first registered font that covers each complete grapheme, measures
the prepared opportunities, reshapes the exact fragments selected as lines,
scales font units once, and delegates to the same resolved layout core.

All named font keys must exist. Missing keys, missing grapheme coverage, invalid
UTF-16/style boundaries, and invalid serialized values throw
`TextPreparationError` with a stable `code`, source range, and attempted keys
where applicable. Neither operation fetches, discovers, caches globally,
mutates, or disposes fonts.

The production policy pins `bidi-js@1.0.3` (Unicode 13.0.0 bidi data),
`unicode-script@1.2.0` (Unicode 17.0.0 Script/Script_Extensions data), and
`linebreak@1.1.0` (Unicode 13.0.0 line-break data). The local adapter normalizes
dependency output into project-owned immutable records. Dependency upgrades
require rerunning the canonical corpus.

## Expert resolved-run usage

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
      fontUnitScale: 10 / 1000,
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

Expert callers may add `breakOpportunities` using the exported structural
`LineBreakOpportunity` type. When supplied, optional opportunities replace the
legacy whitespace wrap candidates; required opportunities still split under
`whiteSpace: 'nowrap'`. Omitting the field preserves the existing resolved-run
whitespace policy. The resolved core remains pure and does not import
`linebreak` or reshape fonts.

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
Set each run's `fontUnitScale` to the same `fontSize / unitsPerEm` conversion.
The layout function does not apply that scale to measurements; it preserves the
value on every positioned glyph so any renderer can transform a lazily obtained
font-unit outline without recovering the source run or inspecting font facts.
Keeping `bounds` as `null` avoids outline work and produces a `null`
`visibleBounds`; consumers can obtain outlines lazily when a renderer actually
needs them.

`LayoutResult` is the complete renderer-neutral handoff. It contains positioned
glyph references, `fontUnitScale`, lines, bounds, carets, and stable font/style
keys, but no outlines, SDF pixels, atlas slots, GPU resources, or renderer
objects. Canvas, SVG, Three.js, or another renderer can consume the same result
and resolve only the outlines it needs from the caller-owned font registry.

## Supported policy

- CRLF, CR, LF, NEL, vertical-tab, form-feed, line-separator, and
  paragraph-separator hard breaks with original UTF-16 indices
- default Unicode 13 line-break opportunities for raw text, exact reshaping at
  selected boundaries, no-wrap overflow, and grapheme/cluster-safe
  `break-word` fallback
- left, center, right, and eligible-whitespace justification
- resolved bidi-level visual placement without reversing HarfBuzz's
  direction-local glyph order
- mixed run metrics, indentation, letter spacing, normal or explicit line
  height, and numeric/keyword/percentage anchors
- block and optional visible bounds, logical caret stops, and pure selection
  rectangles
- grapheme-safe raw-text preparation with whole-text bidi levels, ISO 15924
  script adoption, style intersection, and explicit ordered caller-font fallback

Raw-text composition keeps glyph bounds `null` and never calls `getOutline()`;
renderers can resolve outlines lazily from each positioned glyph's font key,
glyph ID, variations, and `fontUnitScale`. Consequently `visibleBounds` may be
`null` while block/line bounds, carets, and selection rectangles remain
available. Consumers that already own exact glyph bounds can supply them through
`layoutResolvedText()`.

The Unicode 13 algorithm is not complete browser CSS behavior. Dictionary
segmentation for complex-context scripts, automatic hyphenation, locale and
CSS `line-break`/`word-break` tailoring, newer Unicode line-break data, bidi
caret affinity, incremental editing, worker adapters, font fetching, shared
caches, and color-font policy remain follow-ups. Upstream documents roughly 50
skipped cases among more than 7,600 conformance fixtures; see the third-party
notice and validation record for the accepted evidence boundary.

The normative layout and preparation evidence is documented in
[`docs/validation/layout-policy.md`](../../docs/validation/layout-policy.md) and
[`docs/validation/text-preparation-boundary.md`](../../docs/validation/text-preparation-boundary.md),
with Unicode opportunity and exact-composition evidence in
[`docs/validation/unicode-line-breaking.md`](../../docs/validation/unicode-line-breaking.md).

# `@webgpu-text/font`

Renderer-neutral font loading, HarfBuzz shaping, font facts, coverage, and lazy numeric glyph outlines.

The package is strict TypeScript and ESM-only. It does not fetch URLs, perform paragraph layout or fallback, generate SDFs, import Three.js, require browser globals, or depend on the repository's `old/` and `experiments/` directories.

## Usage

```ts
import { loadFont } from '@webgpu-text/font'

const font = await loadFont(fontBytes)

const run = font.shape({
  text: 'office',
  direction: 'ltr',
  script: 'Latn',
  language: 'en',
  features: ['liga=1'],
  variations: { wght: 500 }
})

// Outlines are computed only when requested and cached by glyph and variations.
const outline = font.getOutline(run.glyphs[0].glyphId, run.variations)

font.dispose()
```

`loadFont` accepts an `ArrayBuffer` or a `Uint8Array`. It copies the provided bytes, so later changes to the source buffer cannot affect the loaded font.

## Input formats

- TrueType-flavored SFNT fonts (`.ttf`)
- CFF/OpenType-flavored SFNT fonts (`.otf`)

WOFF and WOFF2 are rejected with `UnsupportedFontFormatError`. Font collections and malformed or truncated inputs are rejected with `InvalidFontError`. Decode web-font containers before passing their bytes to this package.

## Shaping contract

`shape` handles one already-resolved directional and script run. The caller supplies `direction`, `script`, and `language`; paragraph bidi orchestration, fallback selection, wrapping, and final placement belong to the layout package.

Glyph `cluster` values are JavaScript UTF-16 indices into the input string. Features and variation coordinates apply only to the current operation. Known variation axes are clamped to their font-defined ranges and returned in canonical tag order.

## Numeric outlines

`getOutline(glyphId, variations?)` returns immutable typed-array data without constructing or reparsing SVG paths:

| Opcode | Command | Coordinates |
| ---: | --- | ---: |
| `0` | move to | 2 |
| `1` | line to | 2 |
| `2` | quadratic curve | 4 |
| `3` | cubic curve | 6 |
| `4` | close path | 0 |

The result contains `commands`, a flat `coordinates` array, and bounds. Treat the returned arrays as readonly: cached calls may return the same objects. Empty glyphs produce empty arrays and zero bounds. Results are cached for each glyph ID and canonical variation set.

## Lifetime

A `FontHandle` owns its HarfBuzz objects and caches. Call `dispose()` when finished. Disposal is idempotent; every other operation throws `DisposedFontHandleError` after disposal.

## Runtime footprint

The package vendors an attributed, pinned HarfBuzzjs runtime so consumers get a reproducible ESM package. The uncompressed runtime is approximately 390 KB of WASM plus 97 KB of generated and adapted ESM before compression. See `THIRD_PARTY_NOTICES.md` for exact revisions, hashes, licenses, and local modifications.

## Deliberately deferred

URL fetching, WOFF/WOFF2 decoding, font collections, paragraph layout, fallback policy, workers, SDF generation, atlas management, and rendering are outside this package.

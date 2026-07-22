## Why

Color emoji is the largest remaining gap between the current monochrome SDF pipeline and ordinary browser-like text. The project needs evidence about which OpenType color representation to support first and where that payload belongs before a format-specific parser or renderer contract becomes production API.

## What Changes

- Add a private, strict-TypeScript, ESM-only validation spike that compares representative COLR/CPAL, color-bitmap, and SVG color glyphs using pinned, redistributable real-font evidence.
- Inventory the color-font capabilities present in the pinned HarfBuzz engine, the exports available from the bundled WASM runtime, and the smallest viable access path for each candidate format.
- Prove or reject the hypothesis that the existing renderer-neutral positioned-glyph stream can remain unchanged while color payloads are resolved lazily from caller-owned fonts.
- Exercise text-versus-emoji presentation, variation selectors, emoji modifiers, regional indicators, ZWJ sequences, fallback ordering, palettes, intrinsic color, and monochrome fallback at the font/layout boundary.
- Build only the minimum private WebGPU rendering evidence needed to validate the strongest candidate's resource, cache, bounds, opacity, and disposal behavior alongside the existing SDF path.
- Produce a decision report that selects one first production format, sketches the narrow font and renderer contracts it requires, records rejected alternatives, and scopes the follow-up implementation change.
- Update the roadmap and architecture only from recorded evidence; do not add public color-glyph APIs or claim complete color-font support in this spike.

## Capabilities

### New Capabilities

- `color-glyph-boundary-validation`: Defines the fixture evidence, candidate comparison, renderer-neutral seam proof, actual-WebGPU observation, and decision record required before production color-glyph support.

### Modified Capabilities

None.

## Impact

- Adds a private validation experiment, attributed color-font fixtures or reproducible fixture acquisition, machine-readable observations, and a human-readable decision report.
- May add spike-only tooling needed to inspect OpenType tables or expose narrowly selected existing HarfBuzz WASM functions, but does not add a second general-purpose production font parser.
- Exercises the public font, layout, SDF, and Three packages without changing their production contracts.
- Does not implement all color-font formats, alter `LayoutResult`, fetch fonts, add WebGL support, or publish a new package.

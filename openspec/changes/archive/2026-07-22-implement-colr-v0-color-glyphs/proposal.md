## Why

The production renderer can draw only monochrome SDF glyphs, so ordinary multicolor emoji remain incomplete. The completed color-glyph validation selected COLR v0 + CPAL as a maintainable first increment and proved that it can remain lazy, reuse the current outline/SDF path, and preserve the renderer-neutral layout handoff.

## What Changes

- Extend `@webgpu-text/font` with a narrow lazy COLR v0 layer and CPAL palette operation over its already-owned font bytes.
- Extend the structural Three font boundary so `Text` can detect supported color layers after layout and fall back to the existing ordinary outline path otherwise.
- Compose ordered COLR v0 layer outlines through the existing SDF atlas and per-instance color path, including CPAL palette 0 and the current-foreground sentinel.
- Preserve shared-resource reuse, atomic synchronization, private/shared ownership, idempotent disposal, and caller-owned font lifetime for color and monochrome glyphs.
- Validate the accepted emoji corpus, mixed styled text, multiple sizes and foregrounds, packed-package consumption, browser ESM, and semantic actual-WebGPU output.
- Keep `PreparedText`, `LayoutResult`, `@webgpu-text/sdf`, font acquisition, and explicit caller font ordering unchanged.
- Explicitly exclude COLR v1 paint graphs, embedded bitmap formats, SVG documents, implicit browser emoji preference, and a universal color-glyph abstraction.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `font-engine-core`: Add a public, renderer-neutral, lazy COLR v0/CPAL glyph-layer capability with strict validation, caching, foreground handling, and deterministic lifecycle behavior.
- `three-webgpu-text-core`: Add lazy ordered COLR v0 layer composition, shared-resource identity and reuse, monochrome fallback, atomic updates, and actual-WebGPU evidence without changing the layout or SDF contracts.

## Impact

- Public API additions in `@webgpu-text/font` and the structural `TextFont` surface in `@webgpu-text/three`.
- Internal bounded COLR/CPAL table access using the font handle's owned byte copy; no new font parser or runtime dependency.
- Renderer planning and instance assembly changes that reuse the current SDF atlas, TSL materials, and `styleColors`/foreground inputs.
- New production tests and documentation derived from the committed validation fixtures and evidence.
- No changes to `@webgpu-text/layout`, `@webgpu-text/sdf`, HarfBuzz WASM exports, font fetching, Three renderer ownership, WebGL, or CommonJS support.

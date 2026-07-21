## Why

The HarfBuzz validation spike has resolved the shaping, format, cluster, and lifecycle risks, but the public `@webgpu-text/font` package is still an empty shell. Implementing the renderer-neutral font boundary now creates the first independently useful production package and gives layout and SDF work stable contracts to build against.

## What Changes

- Implement the strict-TypeScript, ESM-only `@webgpu-text/font` package around HarfBuzzjs.
- Add asynchronous loading from `ArrayBuffer` and `Uint8Array` inputs into an opaque, project-owned `FontHandle`.
- Expose normalized font facts, Unicode coverage checks, explicit-run shaping, UTF-16 cluster ranges, glyph advances and offsets, and variation coordinates without leaking HarfBuzz or Emscripten objects.
- Add lazy numeric glyph-outline extraction with typed command and coordinate arrays, deterministic bounds, and variation-aware caching; SVG path strings are not part of the implementation or public contract.
- Add idempotent handle disposal and keep worker termination as a separate whole-engine teardown boundary.
- Accept TrueType TTF and CFF-flavored OpenType inputs and reject WOFF/WOFF2 with typed errors before creating a HarfBuzz face.
- Promote the validated fixtures and observations into production package tests while keeping the private experiment as historical evidence rather than a runtime dependency.
- Add the required HarfBuzz and fixture attribution to repository provenance records.
- Update package documentation, architecture, and roadmap status to describe the implemented boundary and its deliberately deferred concerns.

## Capabilities

### New Capabilities

- `font-engine-core`: Defines the production font-loading, shaping, coverage, outline, caching, error, and lifecycle contracts exposed by `@webgpu-text/font`.

### Modified Capabilities

None.

## Impact

- Replaces the empty export surface in `packages/font` with the first production API and tests.
- Adds a pinned HarfBuzzjs runtime dependency plus the smallest attributed wrapper-layer bridge needed for direct drawing callbacks and deterministic disposal when those operations are not available in the published API.
- Reuses committed HarfBuzz validation fixtures and expected shaping results without importing runtime code from `experiments/` or `old/`.
- Establishes `FontHandle`, `ShapedRun`, and `GlyphOutline` as downstream contracts for layout and SDF work; it does not implement fetching, fallback selection, paragraph bidi, line layout, workers, SDF generation, or rendering.

## Context

The `@webgpu-text/font` package already returns lazy numeric glyph outlines and
the resolved layout core returns stable font/glyph identities. The SDF package
is still an empty ESM shell, while the proven renderer seam expects a
single-channel distance bitmap before packing it into a renderer-owned RGBA
atlas.

Troika's `SDFGenerator.js` is not the reusable algorithm: it selects WebGL,
schedules workers, writes channels into a canvas, and reports timing. Its CPU
fallback calls `webgl-sdf-generator@1.1.1`. The pinned npm package contains an
MIT-licensed JavaScript implementation that flattens paths, evaluates nearest
segment distance and non-zero winding at texel centers, and applies an
exponential 8-bit encoding. This change adapts only that CPU behavior to the
project's numeric outline contract.

## Goals / Non-Goals

**Goals:**

- Publish a synchronous, deterministic numeric-outline to `SdfBitmap` API.
- Make public font outlines structurally usable without a font runtime import
  or SVG serialization.
- Preserve the accepted CPU pixel policy behind reviewed golden fixtures.
- Validate allocation, geometry, and numeric inputs before doing raster work.
- Preserve exact third-party attribution and keep the package independently
  installable in Node.js and browsers.

**Non-Goals:**

- WebGL, WebGPU, canvas, image elements, GPU compute, or browser feature
  detection.
- Worker pools, scheduling, cancellation, timing, caching, batching, or async
  APIs.
- Atlas allocation, RGBA channel packing, padding policy, texture upload, or
  renderer lifecycle.
- Font parsing/shaping, outline lookup, layout, SVG path parsing, or a general
  vector-graphics API.
- MSDF generation, hinting, color glyphs, variable-resolution policy, or
  performance redesign beyond the accepted CPU algorithm.

## Decisions

### Accept typed numeric commands, not path strings

The public `SdfOutline` contract uses `Uint8Array` opcodes matching move, line,
quadratic, cubic, and close plus a flat `Float32Array` of coordinates. A public
font `GlyphOutline` is structurally assignable because it already has those
fields; its extra bounds field is harmless. The view box remains explicit
because padding and bitmap coverage are renderer/orchestration choices, not
properties of the outline itself.

This avoids the upstream SVG-like string parser, float-to-string-to-float
round-trips, and a dependency from `sdf` back to `font`. Accepting arbitrary SVG
paths was rejected because it would add a second parsing product and broaden the
command and error surface without helping the text pipeline.

### Expose one object input and a self-describing bitmap

The intended surface is:

```ts
interface SdfOutline {
  readonly commands: Uint8Array
  readonly coordinates: Float32Array
}

interface GenerateSdfInput {
  readonly outline: SdfOutline
  readonly viewBox: { readonly left: number; readonly bottom: number; readonly right: number; readonly top: number }
  readonly width: number
  readonly height: number
  readonly distance: number
  readonly exponent: number
}

interface SdfBitmap {
  readonly pixels: Uint8Array
  readonly width: number
  readonly height: number
  readonly viewBox: GenerateSdfInput['viewBox']
  readonly distance: number
  readonly exponent: number
}
```

`generateSdf(input)` returns newly owned pixels and copied metadata. It does not
mutate or retain caller arrays. Required explicit options make cache keys and
renderer decoding reproducible; implicit defaults were rejected at this layer.

### Preserve the pinned CPU policy while replacing its parser and wrappers

The implementation will port the CPU functions from the published
`webgl-sdf-generator@1.1.1` ESM bundle, identified by npm integrity
`sha512-9Z0JcMTFxeE+b2x1LJTdnaT8rT8aEp7MVxkNwoycNmJWwPdzoXzMh0BjJSh/AEFP+KPYZUli814h8bJZFIZ2jA==`.
It will keep the fixed curve sampling, nearest-line distance, sorted-segment
short circuit, non-zero winding rule, texel-center sampling, exponential
encoding, rounding, and byte clamping. Normalized distance is clamped before
exponentiation, matching the upstream WebGL shader and documented saturation
behavior; the published CPU function omitted that clamp and produces invalid
far-distance values for even or fractional exponents. String parsing, WebGL
branches, framebuffer and canvas helpers, factory/stringification machinery,
and fallback logging are deleted.

The numeric adapter will ignore zero-length drawing segments, matching the
source's line behavior and avoiding undefined winding contributions. Row zero
maps to the view box's `bottom` edge and pixels are row-major. An empty or fully
degenerate outline returns all-zero pixels, the saturated outside value, rather
than relying on arithmetic involving infinity.

Replacing the algorithm wholesale with a new Euclidean-distance or raster
transform implementation was rejected for this slice: it would discard the
existing renderer decoding assumptions and mature behavior before the ordinary
text pipeline is connected. Future optimization requires benchmark and visual
evidence behind the same public contract.

### Validate completely before allocation

`InvalidSdfInputError` is thrown for invalid dimensions, allocation overflow,
view boxes, distance/exponent values, opcodes, command sequencing, coordinate
counts, and non-finite coordinates. Validation walks the command stream without
modifying it and calculates the exact coordinate consumption before allocating
the bitmap or segment list.

The implementation stays deliberately small: private command validation and
flattening feed a private CPU generator. No provider, registry, session,
backend, or strategy abstraction is introduced for a single implementation.

### Separate normative pixels from integration evidence

Synthetic fixtures use simple reviewed outlines and store complete expected
bytes and metadata. Their baseline is captured from the pinned upstream CPU
implementation through a one-time numeric-to-equivalent-path reference tool;
ordinary tests and fixture regeneration do not install the upstream package or
read `old/`. Analytic assertions cover orientation, midpoint/saturation,
inside/outside winding, holes, and empty output so snapshots are explainable.

Separate integration tests load committed font bytes through the public font
API, request representative line/quadratic/cubic outlines, and pass them
directly to `generateSdf()`. These tests assert structural compatibility,
determinism, dimensions, and valid output ranges, not immutable real-font pixel
snapshots.

### Keep attribution beside the distributed adaptation

The package will ship `THIRD_PARTY_NOTICES.md` and the full upstream MIT text,
including `Copyright (c) 2021 Jason Johnston`. The root `NOTICE.md` will record
the package version, npm integrity, adapted source area, removed source areas,
and local fixture derivation. Adapted implementation files will carry a concise
provenance header. `webgl-sdf-generator` is not a dependency.

## Risks / Trade-offs

- **[CPU cost grows with pixels times candidate segments]** → Keep bitmap sizes
  explicit, preserve the source's segment sorting/short circuit, add a modest
  benchmark observation, and defer workers or a new algorithm until profiling
  of real text demonstrates need.
- **[Fixed curve flattening can miss detail at extreme scale]** → Preserve it
  for compatibility and cover quadratic/cubic fixtures; changing tolerance is
  a future policy change with new visual evidence.
- **[Golden bytes can obscure the geometry policy]** → Pair snapshots with
  analytic assertions and document every fixture's intent.
- **[An 8-bit exponential field loses far-edge precision]** → Return distance
  and exponent with the bitmap so the renderer can invert the exact encoding;
  MSDF or wider formats remain separate capabilities.
- **[Numeric orientation can be misread by the renderer]** → Specify row-major
  indexing and bottom-row sampling in the public contract and include a
  non-symmetric orientation fixture.
- **[Adapted bundled source complicates provenance]** → Pin version, shasum,
  integrity, license, copied functions, and local changes in package and root
  notices before implementation is considered complete.

## Migration Plan

The package currently exports nothing, so this is additive with no consumer
migration. Implement contracts and validation first, capture and review
synthetic reference fixtures, port the CPU kernel, add public-font and package
boundary tests, then update architecture/roadmap status. Rollback is removal of
the new exports and files; no persisted data or higher package contract changes.

## Open Questions

None for this slice. Worker adapters, configurable curve tolerance, decode
helpers, cache-key helpers, and alternative SDF formats require separate
evidence and proposals.

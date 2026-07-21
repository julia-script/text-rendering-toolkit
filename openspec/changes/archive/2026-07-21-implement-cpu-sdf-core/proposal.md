## Why

`@webgpu-text/sdf` is the last empty renderer-neutral package in the ordinary
text pipeline. Implementing its pure CPU boundary now turns lazy font outlines
into deterministic pixels without coupling reusable SDF generation to workers,
canvas APIs, atlas policy, or the Three.js renderer.

## What Changes

- Expose a strict TypeScript, ESM-only `generateSdf()` operation over numeric
  outline commands, an explicit view box, bitmap dimensions, distance range,
  and encoding exponent.
- Return a renderer-neutral `SdfBitmap` containing one-channel `Uint8Array`
  pixels and the metadata required to decode them, with no canvas or GPU state.
- Port only the CPU algorithm from the MIT-licensed
  `webgl-sdf-generator@1.1.1`, retaining its copyright and permission notice and
  recording exact provenance and local adaptations.
- Validate all inputs and define deterministic behavior for empty outlines,
  degenerate geometry, curves, holes, winding, clipping, padding, and invalid
  numeric data.
- Add deterministic synthetic golden fixtures plus public
  `@webgpu-text/font` outline integration that does not make a font revision the
  pixel-policy oracle.
- Verify clean package installation, ESM/type exports, and operation without
  `old/`, DOM, canvas, WebGL, WebGPU, Three.js, workers, layout, or atlas code.

## Capabilities

### New Capabilities

- `cpu-sdf-core`: Pure numeric-outline to one-channel signed-distance-field
  generation, validation, encoding, provenance, and package boundaries.

### Modified Capabilities

None.

## Impact

- Replaces the empty `packages/sdf` shell with its first production API and
  tests.
- Adds committed SDF fixtures and package-local third-party notices derived
  from the pinned MIT source.
- Adds no renderer or browser runtime dependency and does not change the public
  font or layout contracts.
- Establishes the `SdfBitmap` seam consumed later by the renderer-owned atlas.

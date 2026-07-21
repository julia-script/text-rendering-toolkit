## Why

`@webgpu-text/three` can render prepared text only as an unlit surface, so it
cannot participate naturally in lit 3D scenes or cast and receive glyph-shaped
shadows. The isolated WebGPU experiment has already proven the required public
Three.js node hooks; the next bounded step is to integrate that exact planar
seam with the production real-font renderer.

## What Changes

- Add a construction-time choice between the existing unlit material and one
  dedicated planar standard material, with unlit remaining the default.
- Reuse the production glyph placement, RGBA atlas sampling, color, opacity,
  clipping, synchronization, and disposal paths for both material kinds.
- Give the standard variant fixed planar normals and the proven SDF shadow mask
  so ordinary Three.js `castShadow` and `receiveShadow` flags produce
  glyph-shaped results.
- Keep material kind immutable for a `Text` object's lifetime and keep the first
  standard-material surface intentionally fixed; runtime material switching,
  curved normals, two-sided lighting, physical-material controls, normal maps,
  and arbitrary caller materials remain out of scope.
- Extend deterministic, packed-consumer, example, and actual-WebGPU real-font
  evidence to cover lit rendering, cast shadows, received shadows, updates, and
  disposal without changing the renderer-neutral `LayoutResult` handoff.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `three-webgpu-text-core`: Extend the production Three.js text mesh with a
  construction-fixed planar standard material and actual-WebGPU lighting and
  shadow guarantees.

## Impact

- Public API: one optional construction-time material-kind choice on `Text`;
  existing callers remain unlit by default.
- Production code: `packages/three` geometry, TSL material assembly, public
  types, lifecycle tests, README, and clean-package consumer.
- Evidence: the public Three example and real-font WebGPU fixture will exercise
  the standard variant using the already validated public Three.js hooks.
- Dependencies and boundaries: no new dependency, package, renderer, text-policy
  API, font-fetching behavior, WebGL path, or compatibility layer.

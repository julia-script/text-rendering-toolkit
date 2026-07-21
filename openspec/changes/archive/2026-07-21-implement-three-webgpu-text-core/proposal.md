## Why

The font, resolved-layout, and CPU SDF packages now provide production contracts,
and the TSL/WebGPU seam has already been proven, but `@webgpu-text/three` is still
an empty shell. The next useful milestone is the smallest production renderer
that composes those pieces into an ordinary Three.js text mesh without claiming
the still-unimplemented itemization, fallback, worker, lighting, or batching
features.

## What Changes

- Implement a public `Text` mesh that accepts caller-owned font handles and a
  fully resolved layout input, exposes promise-based `sync()`, and commits only
  the newest requested state.
- Resolve glyph outlines lazily on atlas misses, generate one-channel SDFs
  through `@webgpu-text/sdf`, and keep font-byte acquisition entirely outside
  the package.
- Add a renderer-owned RGBA atlas with deterministic flat slots, channel packing,
  growth, cache reuse, full-texture dirty uploads, and explicit disposal.
- Promote the proven instanced unit-quad geometry and flat unlit TSL material for
  SDF coverage, per-style color, opacity, and rectangular clipping on Three.js
  `WebGPURenderer`.
- Expose the committed `LayoutResult` and selection rectangles without embedding
  outlines, SDF pixels, or renderer state into the layout package.
- Add deterministic atlas, synchronization, lifecycle, packaging, and public
  cross-package tests plus a minimal actual-WebGPU browser example and semantic
  visual fixture.
- Keep each `Text` instance self-contained in this first version; shared atlases,
  eviction, workers, raw-text itemization/fallback, curved placement, lighting,
  shadows, batching, WebGL, and arbitrary material derivation remain out of
  scope.

## Capabilities

### New Capabilities

- `three-webgpu-text-core`: Defines the resolved-input public text lifecycle,
  renderer-owned atlas, instanced TSL rendering, updates, selection access,
  validation evidence, and disposal contract for `@webgpu-text/three`.

### Modified Capabilities

None.

## Impact

- Replaces the empty `packages/three` export with the first production public
  API and adds focused internal atlas, geometry, material, and synchronization
  modules.
- Composes the existing `@webgpu-text/layout` and `@webgpu-text/sdf` public APIs;
  caller font handles are accepted structurally and remain caller-owned.
- Promotes only the validated concepts from the private WebGPU experiment while
  retaining Three.js `0.185.1` as the narrow initial peer boundary.
- Adds a public-only example, browser visual evidence, package tests, and roadmap
  and architecture updates; it introduces no WebGL path or lower-package GPU
  dependency.

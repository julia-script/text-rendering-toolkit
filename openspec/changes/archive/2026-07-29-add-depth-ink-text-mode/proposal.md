## Why

`Text` renders every fragment in a single transparent pass with `depthWrite: false`. That has two consequences downstream renderers cannot work around from outside the material: overlapping glyph ink (connected scripts, tight kerning, script joins) blends more than once per pixel and shows darker seams on semi-transparent text, and text never writes the depth buffer, so it cannot occlude geometry behind it in scenes whose occlusion model is the z-buffer. The first consumer that needs both — effect-motion's frame renderer, migrating off troika onto this toolkit — currently maintains its own two-pass SDF material for exactly these properties; landing the mode here lets that renderer delete its fork and gives every other consumer depth-correct text.

## What Changes

- Add an opt-in `depthInk` construction option to `Text` (fixed at construction, like `lit`). Default `false` — existing behavior is unchanged.
- With `depthInk: true`, the mesh renders in two passes sharing one instanced geometry and one set of material controls:
  - a **core pass** for fully-covered fill ink (fill coverage ≥ 0.5 inside the clip rect) that draws at flat string opacity, writes depth with a less-than depth test, and alpha-tests away non-ink fragments — deduplicating overlapping ink and giving text z-buffer occlusion;
  - an **edge pass** for everything else (antialiasing ring, outline, shadow) that blends without depth writes, rejected by the depth buffer wherever core ink already landed.
- Core membership is decided on **fill** coverage, not composed coverage, so soft shadow interiors and outline ramps keep their gradients.
- `depthInk: true` combined with `lit: true` rejects at construction with `InvalidTextInputError` until a lit variant is designed.
- Appearance updates (`opacity`, `clipRect`, outline, shadow) keep working unchanged through `sync()` — both passes read one shared set of uniform controls.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `three-webgpu-text-core`: `Text` gains the `depthInk` construction option and the two-pass rendering contract above — depth-writing deduplicated core ink, depth-read-only edge blending, unchanged single-pass default, and the lit-combination rejection.

## Impact

- `packages/three/src/rendering.ts`: node assembly accepts shared uniform controls; new layered material creator producing the core/edge pair.
- `packages/three/src/text.ts`: `depthInk` option, internal edge-pass child mesh sharing the instanced geometry, disposal of both materials.
- `packages/three/src/types.ts`: `TextOptions.depthInk`, material type widening.
- No changes to `font`, `layout`, `sdf`, atlas packing, or the `LayoutResult` contract.
- Ships as a minor release (target 0.3.0); effect-motion's renderer migration consumes it.

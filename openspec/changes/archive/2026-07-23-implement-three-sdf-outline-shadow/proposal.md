## Why

`@webgpu-text/three` already stores the distance information needed for common glyph paint, but applications still need custom materials to draw an outline or drop shadow. The preceding WebGPU validation proved that ordinary glyphs can gain both effects from their existing SDF and atlas slot, so this is the next bounded production step.

## What Changes

- Add mutable, sync-driven appearance controls for one independent-color glyph outline and one independent-color offset/softened drop shadow on `Text`.
- Apply the same paint model to the existing unlit and construction-fixed planar-lit materials without introducing shader rewriting or another renderer abstraction.
- Reuse each ordinary glyph's current SDF pixels and stable shared atlas slot when only outline or shadow appearance changes.
- **BREAKING** Require the structural renderer font contract to expose its existing `facts.unitsPerEm`, and add fixed em-based `sdfPadding` to `TextResources`, so every glyph reserves a consistent configurable paint distance rather than a fraction of its ink bounds.
- Validate requested paint extent against the selected `TextResources` SDF padding before any geometry, material, or shared-resource mutation; reject unsupported paint instead of clipping or silently clamping it.
- Expand renderer bounds for accepted outline and directional shadow extents while applying the existing local clip rectangle to the composed result.
- Keep COLR v0 composed-silhouette outline and shadow explicitly unsupported in this increment, avoiding visible seams between color layers until that semantic is designed separately.
- Add deterministic, packed-consumer, documentation, and actual-WebGPU evidence for reuse, visual composition, updates, rejection recovery, shared borrowers, and disposal.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `three-webgpu-text-core`: Extend the Three WebGPU text mesh with ordinary-glyph SDF outline and one drop shadow, including public appearance controls, resource reuse, bounds, clipping, validation, atomic synchronization, and explicit COLR limits.

## Impact

- Changes the public `@webgpu-text/three` `TextOptions` and `Text` appearance surface additively, adds `TextResourcesOptions.sdfPadding`, and requires `TextFont.facts.unitsPerEm`; the public `FontHandle` already satisfies the expanded structural contract.
- Updates the package's TSL node assembly, synchronization validation, render-bound calculation, tests, README, examples, and actual-WebGPU fixture.
- Does not change `@webgpu-text/font`, `@webgpu-text/layout`, `@webgpu-text/sdf`, glyph resource identity, font acquisition, layout, interaction geometry, or caller ownership.
- Adds no production dependency and provides no WebGL fallback, arbitrary multi-shadow stack, blur pipeline, custom material derivation, or COLR composed-silhouette paint.

## Why

Every `Text` currently owns an isolated glyph cache and GPU atlas, so multiple labels using the same font and glyphs repeat outline extraction, CPU SDF generation, atlas memory, and texture uploads. Local consumers need an explicit shared renderer-resource owner before scaling to realistic scenes, and that owner should leave room for future color-glyph resources without coupling Three.js to text preparation.

## What Changes

- Add an explicitly application-owned renderer resource object in `@webgpu-text/three` that multiple `Text` instances can share.
- Move glyph identity caching, SDF generation reuse, RGBA slot allocation, atlas growth, and texture lifetime behind that shared owner.
- Let `Text` accept shared resources while retaining a private-resource default for simple standalone use.
- Define deterministic ownership: disposing a text releases only its object-specific geometry and material, while disposing shared resources releases their caches and textures and invalidates further dependent synchronization.
- Preserve atomic `Text.sync()` behavior when atlas additions are planned and committed by shared resources.
- Validate that repeated glyphs across independent text objects are outlined, rasterized, stored, and uploaded once while both objects render correctly through actual WebGPU.
- Keep the public owner representation-neutral so later color-glyph atlases can be added beside the SDF atlas without changing font acquisition or renderer-neutral layout contracts.
- Defer color emoji, line-breaking changes, paint effects, workers, eviction, partial uploads, and batching to separate changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `three-webgpu-text-core`: Replace mandatory per-object atlas ownership with an explicit shareable renderer-resource contract, private default resources, cross-object glyph reuse, coordinated synchronization, and separate resource disposal.

## Impact

- Public API additions in `@webgpu-text/three` for the shared resource owner and the optional `Text` construction dependency.
- Internal changes to atlas/cache ownership, glyph keying, material texture binding, synchronization, and disposal.
- Updated deterministic unit, package-consumer, example, documentation, and actual-WebGPU evidence for shared and private usage.
- No changes to `@webgpu-text/font`, `@webgpu-text/layout`, `@webgpu-text/sdf`, font-byte ownership, `LayoutResult`, WebGL support, or the pinned Three.js revision.

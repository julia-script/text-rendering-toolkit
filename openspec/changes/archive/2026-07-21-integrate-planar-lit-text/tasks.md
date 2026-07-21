## 1. Add the construction-fixed material choice

- [x] 1.1 Add the optional `lit` construction contract and public basic/standard material typing while preserving the unlit default.
- [x] 1.2 Extract the existing placement, atlas sampling, SDF coverage, clipping, color, and opacity expressions into one shared production node assembly.
- [x] 1.3 Add the standard node material binding with fixed planar settings, midpoint clipped shadow mask, visible-side shadow policy, and constant local `+Z` glyph normals.
- [x] 1.4 Keep material choice outside mutable sync snapshots and preserve in-place appearance updates, failure atomicity, atlas behavior, and owned-resource disposal for both variants.

## 2. Cover the public production surface

- [x] 2.1 Add deterministic renderer tests for the unlit default, lit opt-in, planar normals, shared nodes and controls, shadow wiring, fixed material identity, and prohibited private/WebGL paths.
- [x] 2.2 Extend `Text` lifecycle tests across lit synchronization, rapid updates, failure recovery, empty layouts, and repeated disposal without duplicating the existing renderer pipeline.
- [x] 2.3 Update the Three package README, public basic example, and packed clean-TypeScript consumer to demonstrate `lit: true`, ordinary Three shadow flags, and unchanged caller ownership.

## 3. Prove the integrated real-font WebGPU path

- [x] 3.1 Extend the production browser fixture with a controlled light, receiver, and occluder around real Latin/Arabic layout rendered by the public standard variant.
- [x] 3.2 Assert tolerant semantic evidence for light response, multi-cell color and transparent coverage, glyph-shaped cast shadows and cutouts, received-shadow contrast, a post-sync update, actual-WebGPU identity, and repeated disposal.
- [x] 3.3 Record the reviewed machine-readable and visual evidence and update architecture, roadmap, and validation documentation to distinguish shipped planar lighting from deferred material features.

## 4. Verify the bounded integration

- [x] 4.1 Run focused Three package tests, type checks, builds, and packed clean-consumer validation.
- [x] 4.2 Run the full workspace Biome, TypeScript, Vitest, and build commands without `old/` dependencies.
- [x] 4.3 Run the public real-font browser fixture on an actual WebGPU adapter and retain its reviewed evidence.
- [x] 4.4 Validate the OpenSpec change strictly and confirm no runtime material switching, PBR option framework, curved or duplicate shadow geometry, new dependency, WebGL path, or renderer-side text policy entered the implementation.

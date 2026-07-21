## 1. Public renderer boundary

- [x] 1.1 Define the public structural `TextFont`, renderer options, committed-state access, and typed error contracts around `ResolvedLayoutInput` without adding font fetching or font ownership.
- [x] 1.2 Implement validation for font registry entries, units-per-em, SDF settings, colors, opacity, clipping bounds, disposed state, and queries that require a committed layout.
- [x] 1.3 Export only the production `Text` API, supporting values, errors, and types from `@webgpu-text/three`, keeping all atlas and TSL implementation modules private.
- [x] 1.4 Add focused public-contract tests proving that real `FontHandle` values are structurally accepted while missing, disposed, or invalid font entries fail before state commit.

## 2. Private RGBA atlas

- [x] 2.1 Implement deterministic fixed-cell flat-slot allocation and cache identities based on font object identity, glyph ID, sorted variation coordinates, and fixed SDF settings.
- [x] 2.2 Implement one-channel `SdfBitmap` packing into RGBA channels with no cross-channel writes and stable reuse of existing slots.
- [x] 2.3 Implement square-grid atlas growth that copies every existing row, preserves flat slot identities, and exposes one complete dirty byte image for upload.
- [x] 2.4 Own creation, refresh, and idempotent disposal of the atlas `DataTexture` with no renderer or canvas ownership.
- [x] 2.5 Add deterministic tests for four-channel packing, multiple cells, growth byte preservation, cache hits, texture dirtiness, and disposal.

## 3. Glyph-to-SDF composition

- [x] 3.1 Match committed positioned glyphs back to their resolved source runs and validate font key, variation, font size, and units-per-em consistency.
- [x] 3.2 Resolve outlines lazily and derive a deterministic padded square font-unit view box plus its corresponding layout-space quad from the resolved run scale.
- [x] 3.3 Generate missing bitmaps through the public synchronous `generateSdf()` API and skip non-drawing outlines without removing their layout or interaction data.
- [x] 3.4 Add synthetic tests for view-box/quad alignment, zero-width or empty outlines, variation-specific cache keys, and failures that leave an earlier atlas state unchanged.
- [x] 3.5 Add a public-font integration test that shapes and lays out real glyphs, consumes public numeric outlines directly, and proves repeated glyphs perform one outline/SDF insertion.

## 4. Instanced TSL rendering kernel

- [x] 4.1 Promote the narrow typed TSL facade and flat unlit material graph for atlas cell/channel selection, derivative SDF coverage, normalized glyph color, opacity, and local rectangular clipping.
- [x] 4.2 Implement one indexed unit-quad `InstancedBufferGeometry` with capacity-aware bounds, flat-slot, and normalized-color attribute updates plus explicit instance count and render bounds.
- [x] 4.3 Connect atlas growth and dirty updates to the material texture binding so texture replacement or image resizing is atomic from the mesh's perspective.
- [x] 4.4 Add non-browser tests for geometry capacity reuse/replacement, instance ordering, per-style color resolution, material control updates, empty geometry, and owned resource disposal.
- [x] 4.5 Keep production imports free of GLSL strings, `ShaderMaterial`, `onBeforeCompile()`, WebGL APIs, renderer creation, canvas creation, and private experiment modules.

## 5. `Text` synchronization and interaction lifecycle

- [x] 5.1 Implement `Text` as a stable Three mesh that owns its geometry, node material, atlas, cache, revision counter, and committed layout while retaining caller ownership of fonts and input values.
- [x] 5.2 Implement one revisioned microtask queue so rapid `sync()` calls coalesce behind the newest captured state and all callers receive the same settlement.
- [x] 5.3 Build layout, glyph raster, atlas, geometry, and material state transactionally, committing only a complete current revision and preserving the previous render state after an error.
- [x] 5.4 Support repeated valid updates for resolved input, style colors, opacity, clipping, and empty text on the same public object.
- [x] 5.5 Expose the exact committed `LayoutResult` and delegate forward, reversed, empty, and multiline selection queries to the public layout helper.
- [x] 5.6 Implement idempotent disposal that invalidates pending work and releases only object-owned geometry, material, texture, byte, and cache resources.
- [x] 5.7 Add lifecycle tests for initial sync, same-window coalescing, newest-state wins, failed-update recovery, selection parity, dispose-during-sync, repeated disposal, and caller font reuse.

## 6. Public WebGPU evidence

- [x] 6.1 Add a minimal browser fixture that imports only public package exports, acquires committed public font bytes in application code, and constructs resolved multilingual input without importing private modules or `old/`.
- [x] 6.2 Render enough distinct real glyphs to exercise more than one atlas cell and validate tolerant semantic coverage, color separation, opacity, clipping, and expected positioned regions on the pinned actual-WebGPU backend.
- [x] 6.3 After an initial frame, update text and appearance through the same `Text`, await synchronization, and prove new atlas data and instance attributes reach the next frame while unchanged regions remain stable.
- [x] 6.4 Verify committed layout/selection access, repeated create-render-update-dispose cycles, and explicit rejection of unavailable WebGPU or Three's WebGL fallback as passing evidence.
- [x] 6.5 Commit the reviewed browser observation metadata and human-readable frame with fixture integrity and exact reproduction commands.

## 7. Package, example, and architecture documentation

- [x] 7.1 Write the renderer README with the resolved-input contract, caller-owned font acquisition/lifetime, supported appearance controls, synchronization semantics, disposal ownership, and explicit exclusions.
- [x] 7.2 Add `examples/three-webgpu-basic` using only public exports and application-owned byte fetching, renderer, canvas, scene, camera, font handles, and cleanup.
- [x] 7.3 Pack and install `@webgpu-text/three` in a clean ESM/TypeScript consumer and prove its values, declarations, workspace dependencies, and Three peer resolve without undeclared or private paths.
- [x] 7.4 Add boundary checks showing that no lower package imports Three and the renderer contains no dependency on `old/`, experiment internals, DOM work at module evaluation, WebGL, CommonJS, or UMD.
- [x] 7.5 Update `ARCHITECTURE.md` and `ROADMAP.md` from shipped evidence, including the resolved-first public limit and the measured status of atlas growth and actual-WebGPU rendering.

## 8. Final validation

- [x] 8.1 Run renderer unit, integration, lifecycle, and clean-package tests with the ignored reference checkout unavailable.
- [x] 8.2 Run the documented actual-WebGPU browser fixture and inspect its semantic observations and committed frame.
- [x] 8.3 Run workspace formatting, type checking, tests, builds, dependency-boundary checks, and strict OpenSpec validation.

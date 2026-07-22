## 1. Resource owner and atlas binding

- [x] 1.1 Add the public `TextResources` options, lifetime type, disposed-resource error, and root export without exposing atlas or TSL internals.
- [x] 1.2 Move resource-local font identity, canonical glyph keys, empty-glyph caching, lazy outline/SDF resolution, and immutable atlas planning behind `TextResources`.
- [x] 1.3 Give `TextResources` one fixed SDF size, stable `DataTexture`, shared mutable atlas-grid binding, monotonic slot allocation, growth, commit, and idempotent disposal.
- [x] 1.4 Refactor material creation so every borrower observes shared texture growth and atlas dimensions while retaining private opacity and clipping controls.

## 2. Text integration and ownership

- [x] 2.1 Extend `TextOptions` with mutually exclusive injected `resources` or private `sdfSize` configuration and reject ambiguous or disposed-resource construction.
- [x] 2.2 Refactor `Text` synchronization to validate and build against a resource plan, then commit shared additions and the current text state atomically without changing `LayoutResult` or font ownership.
- [x] 2.3 Preserve latest-state coalescing and recovery after validation, outline, and SDF failures without partially committing shared cache or atlas additions.
- [x] 2.4 Update disposal so a text releases its geometry, material, and only its privately created resources, while an injected owner remains usable by other borrowers and rejects use after its own disposal.

## 3. Deterministic verification

- [x] 3.1 Add resource tests for RGBA channel packing, multi-cell growth, stable texture and slot identity, shared dimension propagation, empty glyphs, and idempotent disposal.
- [x] 3.2 Add text tests proving same-handle cross-object outline/SDF reuse, distinct-handle separation, independent committed layouts and appearances, and an older borrower remaining valid after another grows the atlas.
- [x] 3.3 Add failure and lifecycle tests covering invalid mixed configuration, failed plan atomicity, disposing a borrower during pending synchronization, disposing one borrower while another continues, and synchronization after owner disposal.
- [x] 3.4 Preserve and rerun the existing private-resource, planar lighting, shadow-node, package-boundary, and public-font integration tests.

## 4. Public consumers and documentation

- [x] 4.1 Update the package README and API examples to document private convenience, explicit sharing, same-handle reuse, owner-last disposal, no draw-call reduction, and the monochrome-only first implementation.
- [x] 4.2 Update the public Three.js example and documentation application to render multiple independent text objects through one `TextResources` without moving preparation or font acquisition into Three.
- [x] 4.3 Extend the isolated package-family consumer and release-candidate audit to import, type-check, construct, synchronize, and dispose the shared resource API from packed artifacts.

## 5. WebGPU evidence and project handoff

- [x] 5.1 Extend the production browser fixture with repeated real-font glyphs shared across independently positioned texts and atlas growth caused by one borrower after another has rendered.
- [x] 5.2 Verify on the pinned actual WebGPU backend that the earlier borrower remains visually and semantically correct without resynchronization, unlit and lit rendering remain valid, and text-then-resource disposal can be repeated.
- [x] 5.3 Record the shared-resource ownership, cache-reuse, atlas-growth, and WebGPU observations in the renderer validation documentation without claiming batching, color-glyph, eviction, worker, or frame-rate results.
- [x] 5.4 Run repository formatting, linting, type-checking, unit tests, production builds, documentation build, and local release-candidate validation, then update the roadmap to record shared resources as complete and browser-grade line breaking as the next typography priority.

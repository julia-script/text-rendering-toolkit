## Context

`packages/font` is currently an empty package shell. The completed HarfBuzz validation experiment demonstrated that `harfbuzzjs@1.4.0` can initialize in strict ESM Node and browser module workers, shape representative Latin, Arabic, Indic, and Khmer runs, preserve UTF-16 cluster indices, expose normalized font facts, and operate with a persistent font plus a reused shaping buffer. It also established a v1 input policy of TTF and CFF-flavored OTF only.

Two wrapper-surface gaps remain in the published package. It exposes outlines through an SVG construction/reparse convenience path rather than direct numeric drawing callbacks, and it relies on finalizers rather than deterministic object destruction. The packaged WASM already exports the required HarfBuzz drawing and destroy functions, and upstream HarfBuzzjs source contains the direct drawing API. The production package therefore needs a bounded, attributable wrapper adaptation; it does not need a HarfBuzz C fork, a custom WASM build, or a second font parser.

The package must remain renderer-neutral and independently consumable. It cannot import `old/` or `experiments/` at runtime, expose HarfBuzz/Emscripten objects, assume DOM or Three.js availability, or silently introduce layout and fetching policy.

## Goals / Non-Goals

**Goals:**

- Deliver a useful, typed production API from `@webgpu-text/font` for loading normalized font bytes, querying facts and coverage, shaping explicit runs, and retrieving numeric outlines lazily.
- Preserve JavaScript UTF-16 source indices and serializable data contracts suitable for later layout, worker, SDF, and renderer integrations.
- Support TTF and CFF-flavored OTF consistently in Node and browsers while rejecting WOFF/WOFF2 and malformed inputs with typed errors.
- Make variation coordinates explicit in shaping and outline operations and in outline-cache identity.
- Provide deterministic, idempotent disposal of handle-owned native objects and caches.
- Package all adapted runtime artifacts needed by consumers and retain complete MIT/OFL provenance.

**Non-Goals:**

- URL fetching, CSS font matching, font fallback, collections, color fonts, WOFF/WOFF2 decoding, or arbitrary OpenType table inspection.
- Paragraph bidi segmentation, grapheme or caret policy, line breaking, wrapping, alignment, or positioned text layout.
- Worker adapters, SDF generation, atlas allocation, Three.js, WebGPU, or rendering.
- Compatibility with Troika's public API or exact glyph output from its Typr-derived partial shaper.
- Publishing packages to npm or finalizing npm-scope ownership in this change.

## Decisions

### Expose one project-owned opaque handle

`loadFont(source)` asynchronously initializes the engine when necessary, copies exactly the bytes represented by an `ArrayBuffer` or `Uint8Array`, validates the container, and returns a `FontHandle`. The handle exposes readonly facts plus synchronous `supports`, `shape`, and `getOutline` operations after loading, and an idempotent `dispose` operation.

The public surface is expressed through interfaces and plain values rather than exporting the internal wrapper class. The concrete handle owns one HarfBuzz blob, face, font, and reusable buffer. This keeps native identity and caches private, prevents downstream dependence on wrapper internals, and leaves room to change the engine adaptation without changing package consumers.

Alternative considered: expose HarfBuzzjs classes directly. Rejected because it would leak WASM lifetime, make downstream packages depend on an incomplete upstream surface, and turn wrapper upgrades into public breaking changes.

### Keep shaping explicit and operation-scoped

`shape` accepts text plus required direction, script, and language. Optional OpenType features and variation coordinates are normalized and validated before reaching HarfBuzz. It returns a `ShapedRun` containing finite glyph IDs, advances, offsets, flags, UTF-16 cluster start/end ranges, the source text length, and the normalized variation coordinates used for the operation.

Variation coordinates do not become hidden persistent public state. Each shape or outline request applies its explicit coordinates to the internal font before the operation. Canonical tag ordering produces a stable internal variation key. This avoids a call-order bug where an outline could accidentally use the variations from the most recent unrelated shape.

The handle reuses one cleared buffer and is intentionally not concurrently shared across JavaScript realms. Calls are synchronous after loading, so ordinary same-realm use cannot overlap. Whole-paragraph bidi segmentation and caret interpretation remain layout responsibilities.

Alternative considered: mutable `setVariations()` state. Rejected because it creates implicit coupling between calls and makes caching and worker requests harder to reason about.

### Return compact numeric outlines lazily

`getOutline(glyphId, variations?)` invokes direct HarfBuzz drawing callbacks only on a cache miss. It returns a `GlyphOutline` with a `Uint8Array` of documented opcodes, a sequential `Float32Array` of coordinates, and finite axis-aligned bounds. Move and line commands consume two coordinates, quadratic commands four, cubic commands six, and close commands none. Empty glyphs return empty arrays with zero bounds.

The cache key is the handle's private font identity plus canonical variation coordinates and glyph ID. Cached values are exposed as readonly-by-contract typed arrays; callers must not mutate them. The cache is handle-local and cleared on disposal, with no global registry or eviction policy in this first slice.

SVG path construction or parsing is forbidden in the production path. Bounds come from normalized HarfBuzz glyph extents and are checked against emitted coordinates in tests for representative TTF and CFF glyphs.

Alternative considered: return SVG strings or parsed command objects. Rejected because strings add formatting and reparsing allocations, while per-command objects add avoidable hot-path allocation between the font and SDF layers.

### Vendor the bounded wrapper adaptation inside the package

The published `harfbuzzjs@1.4.0` package cannot be patched only in the workspace package manager: such a patch would not follow consumers of a packed or published `@webgpu-text/font` package. Instead, the font package owns an internal, non-exported HarfBuzzjs runtime adaptation derived from an exact upstream revision. It retains the upstream generated loader/WASM artifacts, uses TypeScript for the adapted wrapper source, and backports only:

- typed direct drawing callbacks already supported by the packaged WASM; and
- idempotent native object destruction with finalizer unregistration.

The adapted files, exact upstream revision, modifications, license, and copyright are recorded in the package and root provenance notices. The build copies required WASM/generated runtime assets into `dist`, and a packed-tarball consumer test proves the package does not depend on workspace patches, `experiments/`, or `old/`.

This is a temporary compatibility layer, not a public fork. When an upstream release exposes an equivalent drawing and disposal surface, the internal adaptation can be replaced behind the project-owned handle and its conformance tests.

Alternatives considered:

- A root `pnpm` patch: rejected because dependency patches are not a transitive guarantee for package consumers.
- An unreleased Git dependency: rejected because install-time builds and repository layout would become consumer concerns.
- A separately published internal fork: rejected because it creates another package and release stream for a private implementation detail.
- OpenType.js or Typr for outlines: rejected because it duplicates font parsing and variation state solely to work around a small wrapper gap.

### Detect formats before constructing native objects

Loading inspects the input signature and SFNT structure before creating a HarfBuzz face. TrueType-flavored SFNT and `OTTO` CFF/OpenType inputs proceed. WOFF and WOFF2 signatures throw `UnsupportedFontFormatError`; truncated, empty, collection, or otherwise unusable inputs throw `InvalidFontError`. A failed load destroys any native objects already created.

`Uint8Array` input respects `byteOffset` and `byteLength`; bytes outside the view are never included. The resulting handle owns its WASM copy, so callers may release or mutate their original buffer after `loadFont` resolves without changing the loaded font.

Alternative considered: let HarfBuzz infer all formats. Rejected because unsupported compressed inputs can produce default-looking metrics and empty coverage rather than a clear failure.

### Make lifecycle and misuse observable

`dispose()` destroys the reusable buffer, font, face, and blob in reverse ownership order, clears the outline cache, and marks the handle disposed. Repeated disposal is a no-op. Every operational method checks that state and throws `DisposedFontHandleError` after disposal. Module-level WASM initialization remains shared for the realm and is not torn down by an individual handle; terminating a worker remains the whole-engine cleanup boundary.

Exported error classes distinguish unsupported containers, invalid fonts, invalid shaping inputs, and disposed-handle use. Errors contain no raw WASM pointers or unstable Emscripten messages.

Alternative considered: rely entirely on `FinalizationRegistry`. Rejected because consumers need predictable release for repeated font loads and long-lived browser applications.

### Promote evidence into package-level conformance tests

Production tests reuse the committed font fixtures, integrity metadata, and accepted shaping observations from the validation spike, but import only the package's public entry point. Tests cover Node conformance, package types, browser-safe module construction, TTF/CFF outlines, UTF-16 clusters, variation behavior, format errors, byte-view boundaries, cache behavior, and disposal. A pack-and-install smoke fixture validates that `dist` contains every runtime asset.

The experiment remains unchanged as historical evidence. No production source or test imports experiment implementation modules, and no test reads from ignored `old/`.

## Risks / Trade-offs

- **The internal wrapper adaptation drifts from upstream** → Pin an exact source revision, keep the delta restricted to drawing and destruction, test it through the public contract, and replace it with an upstream release once equivalent APIs ship.
- **Vendored WASM and loader assets make the package larger** → Retain only the normal shaping build, exclude subset artifacts and development files, record packed sizes, and defer custom WASM optimization until measurements justify ownership.
- **Readonly typed arrays can still be mutated at runtime** → Document the contract, keep arrays private until the outline is complete, and avoid relying on consumer-visible identity for correctness.
- **Variation state leaks between operations inside the shared internal font** → Apply canonical coordinates before every shape and outline call and include regression tests that alternate variation settings.
- **Cleanup mistakes cause use-after-free or double destruction** → Centralize ownership in one implementation, destroy in reverse order, unregister finalizers, make disposal idempotent, and test failed construction plus repeated disposal.
- **Exact shaping snapshots change on a future HarfBuzz upgrade** → Pin engine and fixture versions; require intentional observation review rather than silently updating expected results.
- **The provisional npm scope is unavailable** → Keep publishing outside this change; package behavior and export contracts remain valid if manifests are renamed later.

## Migration Plan

1. Add the internal attributed HarfBuzz runtime adaptation and make the font package build copy all required runtime assets.
2. Define the public value types, opcodes, errors, and opaque `FontHandle` interface before adapting experiment behavior.
3. Implement loading, format validation, facts, coverage, shaping, and operation-scoped variation handling.
4. Implement direct outline collection, normalized bounds, variation-aware caching, and deterministic disposal.
5. Promote fixtures into public-entry-point conformance tests and add a packed-package consumer smoke test.
6. Update package documentation and repository provenance, then run workspace checks and OpenSpec validation.

Rollback removes the production implementation and its vendored runtime while restoring the empty package entry point. The completed experiment and its fixtures remain valid evidence; no other production package currently consumes the new API.

## Open Questions

No blocking design questions remain for implementation. The final npm scope, WOFF/WOFF2 decoder strategy, worker adapters, font fallback policy, and cross-handle/global cache policy remain explicitly deferred to later changes.

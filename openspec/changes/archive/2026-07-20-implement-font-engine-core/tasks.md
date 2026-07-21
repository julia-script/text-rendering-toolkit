## 1. Internal HarfBuzz Runtime

- [x] 1.1 Identify and record the exact HarfBuzzjs source revision and embedded HarfBuzz build used for the adapted runtime, then bring only the required typed wrapper, normal shaping WASM, and generated loader assets into the font package.
- [x] 1.2 Backport the upstream typed direct-drawing callbacks and add idempotent native destruction with finalizer unregistration without changing or rebuilding HarfBuzz C/WASM.
- [x] 1.3 Configure the font build and package file list to emit the adapted ESM runtime, declarations, and WASM asset while keeping internal HarfBuzz modules outside the public export map.
- [x] 1.4 Add package-local and root provenance records covering HarfBuzzjs, embedded HarfBuzz, local modifications, licenses, source revisions, and integrity hashes.

## 2. Public Font Contracts

- [x] 2.1 Define and export the opaque `FontHandle`, `FontFacts`, variation-axis, shape-input, shaped-run, shaped-glyph, glyph-outline, bounds, and documented outline-opcode types.
- [x] 2.2 Define and export stable errors for unsupported formats, invalid fonts, invalid shaping inputs, and disposed-handle use without leaking wrapper-native error text.
- [x] 2.3 Implement exact byte-source normalization for `ArrayBuffer` and sliced `Uint8Array` inputs plus preflight SFNT, CFF/OpenType, collection, WOFF, and WOFF2 signature classification.

## 3. Font Loading and Shaping

- [x] 3.1 Implement asynchronous `loadFont` construction with owned bytes, partial-construction cleanup, persistent blob/face/font/buffer ownership, normalized facts, and unusable-face validation.
- [x] 3.2 Implement valid Unicode code-point coverage checks and reject invalid code-point inputs through the public input-error contract.
- [x] 3.3 Implement explicit direction, script, language, OpenType-feature, and variation validation and normalization without paragraph-level inference.
- [x] 3.4 Implement shaping with a cleared/reused buffer and return serializable glyph IDs, UTF-16 cluster ranges, advances, offsets, flags, source length, and normalized variation coordinates.
- [x] 3.5 Ensure variation coordinates are applied before every shaping operation and add call-order isolation so no operation depends on a previous variation setting.

## 4. Lazy Outlines and Lifecycle

- [x] 4.1 Implement direct draw-callback collection into opcode and coordinate typed arrays, normalize glyph extents into finite bounds, and define deterministic empty-glyph output without an SVG path round-trip.
- [x] 4.2 Add handle-local outline caching keyed by canonical variation coordinates and glyph ID, with distinct entries for distinct variation settings.
- [x] 4.3 Implement idempotent `FontHandle.dispose()` in reverse ownership order, clear outline caches, and guard all live-handle operations with `DisposedFontHandleError`.

## 5. Production Conformance Tests

- [x] 5.1 Add public-entry-point tests for TTF and CFF/OpenType loading, normalized facts, code-point coverage, exact `Uint8Array` view handling, source-byte independence, WOFF/WOFF2 rejection, and malformed or collection input cleanup.
- [x] 5.2 Promote the accepted Latin, Arabic, Devanagari, Khmer, combining-mark, supplementary-plane, and RTL shaping observations into package tests for glyph data and UTF-16 cluster boundaries.
- [x] 5.3 Add direct-outline tests for TTF, CFF, empty glyphs, opcode/coordinate arity, finite enclosing bounds, variation call-order isolation, and cache identity.
- [x] 5.4 Add lifecycle tests for failed construction, deterministic destruction, repeated disposal, cache release, and every public use-after-disposal path.
- [x] 5.5 Add a clean packed-tarball consumer smoke test that imports the ESM package, loads a fixture, shapes text, retrieves an outline, and proves all declarations and runtime assets ship without workspace patches or experiment/old imports.

## 6. Documentation and Verification

- [x] 6.1 Document the public API, byte ownership, supported formats, explicit-run boundary, lazy outline usage, readonly typed-array expectation, variation semantics, disposal, engine size, and deferred worker/decoder concerns.
- [x] 6.2 Update `ARCHITECTURE.md` and `ROADMAP.md` to record the implemented font boundary, provenance status, and next layout-fixture milestone without presenting deferred features as complete.
- [x] 6.3 Run package and workspace formatting, type checking, tests, builds, packed-consumer validation, forbidden-import checks, and `openspec validate implement-font-engine-core`, resolving all failures.

## 1. Scaffold the Private Experiment

- [x] 1.1 Create `experiments/harfbuzz-font-engine/` as an explicitly private strict-TypeScript, ESM-only harness with reproducible Node and browser validation commands
- [x] 1.2 Pin HarfBuzzjs and the minimal test/browser tooling, record the wrapper and embedded HarfBuzz versions, and ensure the experiment cannot be published
- [x] 1.3 Add a small shared observation schema that records environment, dependency versions, fixture hashes, inputs, results, and measurement metadata

## 2. Establish the Font Fixture Matrix

- [x] 2.1 Select the smallest redistributable fonts that collectively cover TrueType and CFF outlines plus Latin, Arabic, Indic, Khmer, combining marks, supplementary-plane characters, and at least one variable axis
- [x] 2.2 Add fixture source, license, derivation, and SHA-256 metadata and verify every committed font file against it
- [x] 2.3 Prepare equivalent TTF, OTF, WOFF, and WOFF2 cases where permitted and document how each derived format was produced

## 3. Implement the HarfBuzzjs Adapter Experiment

- [x] 3.1 Implement asynchronous HarfBuzzjs initialization and a provisional opaque `FontHandle` that exposes serializable units-per-em, metrics, coverage, advances, and variation facts without leaking WASM pointers
- [x] 3.2 Implement explicit direction/script/language run shaping with a cleared and reused HarfBuzz buffer, returning glyph IDs, UTF-16 clusters, advances, and offsets
- [x] 3.3 Implement cluster-to-source-range helpers for left-to-right and right-to-left outputs, including ligatures, combining sequences, and supplementary-plane characters
- [x] 3.4 Attempt direct lazy numeric outline callbacks; when the published wrapper proves insufficient, reject the SVG round-trip explicitly and record the bounded callback-bridge requirement and target cache key
- [x] 3.5 Implement a serializable ESM-worker request/response path that initializes, shapes, reports results, and terminates without DOM, renderer, or `old/` dependencies

## 4. Execute Conformance and Lifecycle Validation

- [x] 4.1 Add deterministic shaping observations for Latin kerning/ligatures, Arabic joining/marks, Indic and Khmer reordering/positioning, and explicitly segmented mixed-direction samples
- [x] 4.2 Add assertions that all clusters are valid UTF-16 boundaries and document why cluster boundaries alone do not define every caret position
- [x] 4.3 Add font-fact and variation assertions plus TTF/CFF outline-capability checks that prove the published SVG conversion cannot satisfy the direct numeric contract
- [x] 4.4 Run the TTF, OTF, WOFF, and WOFF2 matrix and record direct support, normalized support, explicit failure behavior, and decoder size/API observations where normalization is required
- [x] 4.5 Measure distributable artifact sizes, cold initialization, warm shaping, font-byte ownership, buffer reuse, sampled JavaScript/WASM memory, and repeated-shaping growth after warm-up
- [x] 4.6 Automate the real-browser module-worker smoke check and verify that worker termination provides a deterministic whole-engine cleanup boundary

## 5. Record Decisions and Close the Spike

- [x] 5.1 Commit machine-readable observations and write `docs/validation/harfbuzz-font-engine.md` with reproduction commands, results, limitations, and the exact dependency/fixture versions
- [x] 5.2 Decide and document the v1 policy for TTF, OTF, WOFF, and WOFF2 plus the cleanup contract for worker, browser-main-thread, and Node use
- [x] 5.3 Decide whether the published wrapper is sufficient and confirm or revise the provisional `FontHandle`, `ShapedRun`, and numeric `GlyphOutline` contracts without implementing the production package
- [x] 5.4 Update `ROADMAP.md` and `ARCHITECTURE.md` so resolved spike questions become decisions and any rejected assumptions become bounded follow-up work
- [x] 5.5 Run every documented clean-install validation command, strict TypeScript checks, automated Node/browser checks, fixture integrity verification, and strict OpenSpec validation

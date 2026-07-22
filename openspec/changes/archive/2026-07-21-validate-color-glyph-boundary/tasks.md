## 1. Private harness and fixture provenance

- [x] 1.1 Create `experiments/color-glyph-boundary/` as a private strict-TypeScript, ESM-only harness using the existing workspace, Vitest, browser, and formatting infrastructure without adding a public package.
- [x] 1.2 Define a small validated observation schema for environment facts, fixture provenance, table inventories, shaped cases, candidate criteria, renderer results, limitations, and evidence references.
- [x] 1.3 Add reproducible acquisition or subsetting commands that verify source revision, license, derivation, and SHA-256 before accepting color-font bytes and never commit a fixture whose terms are unclear.
- [x] 1.4 Acquire or derive the smallest representative COLR v0/CPAL, COLR v1/CPAL, embedded bitmap, and SVG-table fixture set; record table presence and prove each accepted sequence survives derivation.

## 2. HarfBuzz and format access inventory

- [x] 2.1 Add a deterministic runtime inventory that records the vendored HarfBuzzjs and embedded HarfBuzz revisions, WASM hash, relevant build facts, and actual raw-table, draw, layer, palette, paint, PNG, and SVG exports.
- [x] 2.2 Inspect each fixture through the current `hb_face_reference_table` boundary and record color-table sizes, representative glyph coverage, variation data, palette counts, bitmap strikes, and SVG document ranges where applicable.
- [x] 2.3 Implement bounded private probes for COLR v0, COLR v1, embedded bitmap, and SVG payload accessibility without normalizing them into a speculative universal public representation.
- [x] 2.4 Compare the current raw-table route with a reproducible minimal HarfBuzz export bridge for missing upstream color operations, recording correctness, export delta, binary-size delta, browser ESM loading, lifecycle, build command, and maintenance cost.
- [x] 2.5 Evaluate a focused external decoder only if both HarfBuzz routes fail a required candidate operation, and record why a second general-purpose parser remains rejected or is demonstrably unavoidable.

## 3. Presentation, fallback, and layout boundary

- [x] 3.1 Define canonical cases for default text/emoji presentation, U+FE0E/U+FE0F, modifiers, flags, ZWJ sequences, ordinary outline fallback, missing glyphs, explicit font order, and style/font-size/foreground transitions.
- [x] 3.2 Run the corpus through public `prepareText()`, `layoutPreparedText()`, and caller-owned fonts, recording UTF-16 ranges, selected font keys, HarfBuzz glyph IDs, positions, variations, and color-payload availability as separate observations.
- [x] 3.3 Add browser-reference observations using the same pinned downloadable fonts while keeping platform system-font behavior informational and renderer-independent semantic expectations authoritative.
- [x] 3.4 Prove that measurement, carets, and selection can consume the same unchanged `LayoutResult` without color payloads, and capture the smallest counterexample if final positioned identity is insufficient.
- [x] 3.5 Characterize the case where an earlier text font captures an emoji in monochrome and decide from evidence whether explicit font order is sufficient or a later preparation API needs an explicit presentation preference.

## 4. Candidate decision checkpoint

- [x] 4.1 Score all four format families from recorded evidence for useful emoji coverage, scalability, palette/foreground and variation behavior, engine access, bundle/cache cost, renderer complexity, browser ESM fit, lifecycle, and provenance.
- [x] 4.2 Mark unsupported operations and missing evidence explicitly, preventing incomplete COLRv1, unsafe SVG, unavailable bitmap decoding, or unproven fixtures from being described as supported.
- [x] 4.3 Select the highest-scoring viable candidate and record the reason; if two candidates remain materially tied, build at most one additional minimal adapter for the unresolved resource-boundary question and rerun the score.
- [x] 4.4 Record a go, conditional-go prerequisite, or no-viable-candidate checkpoint before starting renderer work so the experiment cannot drift into implementing every format.

## 5. Minimal actual-WebGPU seam proof

- [x] 5.1 For a viable winner, implement one exact private lazy font-payload resolver using the accepted HarfBuzz/table access path; otherwise document the measured prerequisite or no-go evidence and mark renderer-only tasks not applicable in the observation record.
- [x] 5.2 Add the smallest private renderer-owned color resource cache whose identity includes font object, glyph, variations, palette/foreground, size, and only the selected format's pixel-affecting inputs while leaving the production SDF cache unchanged.
- [x] 5.3 Render one mixed line of monochrome SDF text and representative color emoji through the pinned Three `WebGPURenderer`, preserving layout placement, transparent exterior, bounded opacity, and caller-owned font lifetime.
- [x] 5.4 Add deterministic checks for repeated and shared resource reuse, distinct pixel-affecting identities, unsupported or malformed payload failure atomicity, monochrome fallback, and idempotent renderer-resource disposal.
- [x] 5.5 Run actual-WebGPU semantic pixel checks across representative size and presentation cases, record browser/GPU versions and observations, and avoid treating antialiasing-exact screenshots as conformance.
- [x] 5.6 Verify that no production package imports the experiment and that public font, layout, SDF, and Three declarations and packed artifacts remain unchanged by the spike.

## 6. Decision record and project reconciliation

- [x] 6.1 Commit the validated machine-readable fixture, capability, shaping, fallback, candidate-score, resource, and WebGPU observations with complete evidence references.
- [x] 6.2 Write `docs/validation/color-glyph-boundary.md` with reproduction commands, the selected go/conditional-go/no-go outcome, first format or prerequisite, access path, contract sketch, package ownership, fallback behavior, unsupported cases, and production acceptance tests.
- [x] 6.3 Update `ARCHITECTURE.md` and `ROADMAP.md` from the report, preserving color glyphs as unshipped and scoping exactly one production follow-up direction rather than a universal multi-format implementation.
- [x] 6.4 Run experiment tests, affected public-package tests, type checking, formatting, packed-boundary checks, browser checks, and the actual-WebGPU proof; record any environment-dependent command separately.
- [x] 6.5 Run strict OpenSpec validation and confirm every requirement and scenario is backed by an executable check or an attributed recorded decision.

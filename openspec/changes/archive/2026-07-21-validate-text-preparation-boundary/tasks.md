## 1. Establish the isolated evidence harness

- [x] 1.1 Add a private strict-TypeScript ESM text-preparation experiment with candidate dependencies isolated from every publishable package.
- [x] 1.2 Define and validate a versioned canonical fixture schema for raw input, prepared segments, resolved runs, semantic layout expectations, provenance, classification, and rationale.
- [x] 1.3 Assemble attributable synthetic and pinned-public-font cases for Latin, Arabic, Devanagari, Khmer, mixed bidi, Common/Inherited characters, combining sequences, supplementary text, style ranges, fallback, empty input, and missing coverage.

## 2. Evaluate font-independent preparation

- [x] 2.1 Implement the validation-only two-stage candidate with immutable input handling, normalized styles/layout policy, and serializable UTF-16 prepared segments.
- [x] 2.2 Evaluate `bidi-js` against the corpus for paragraph levels, directional segmentation, mixed text, controls, and compatibility with existing resolved layout levels.
- [x] 2.3 Compare at most three bounded script-property approaches and record correctness, Common/Inherited adoption, Unicode version, ESM/TypeScript behavior, size, license, provenance, and update burden.
- [x] 2.4 Add deterministic boundary tests for surrogate pairs, grapheme clusters, combining marks, joiners, variation selectors, hard breaks, and style transitions.

## 3. Evaluate explicit-font resolution and composition

- [x] 3.1 Implement validation-only ordered font selection at grapheme boundaries with stable font keys, adjacent-run coalescing, and deterministic missing-key/coverage errors.
- [x] 3.2 Shape accepted segments through public `FontHandle` operations, apply language/features/variations, scale metrics and glyph data, preserve `fontUnitScale`, and assemble valid `ResolvedLayoutInput`.
- [x] 3.3 Compose through public `layoutResolvedText()` and assert accepted glyph, line, bounds, caret, selection, ownership, failure, and repeated-execution behavior without lower-layer changes.
- [x] 3.4 Compare repeated two-stage and one-call execution and explicitly accept or reject a public serializable prepared value based on semantic reuse and measured cost.

## 4. Record the production decision

- [x] 4.1 Run the complete corpus in Node and a browser-compatible ESM path, validate canonical fixture regeneration, and confirm the harness needs no network, DOM font loading, renderer, or `old/` dependency.
- [x] 4.2 Write the validation report with selected/rejected candidates, normative fallback/style/control rules, dependency and Unicode revisions, artifact sizes, limitations, reproduction commands, and the exact production API recommendation.
- [x] 4.3 Update architecture and roadmap to promote only proven preparation decisions and keep complete line breaking, reshaping, bidi affinity, workers, fetching, emoji/color fonts, and batching explicitly deferred.
- [x] 4.4 Run full workspace formatting, type checks, tests, builds, clean-package checks, and strict OpenSpec validation while confirming publishable package exports and dependencies remain unchanged.

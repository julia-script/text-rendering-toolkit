## 1. Reference Baseline

- [x] 1.1 Record the exact Troika reference Git revision plus integrity hashes for `Typesetter.js`, `FontResolver.js`, `selectionUtils.js`, and the relevant `TextBuilder.js` seam without copying those modules into production source.
- [x] 1.2 Inventory the reference inputs and outputs, assigning every field to the draft layout contract, a future font-provider/itemization boundary, or an explicitly excluded renderer concern.
- [x] 1.3 Define the focused fixture matrix and stable case identifiers for line construction, placement, bidi, styles/fonts, interactions, bounds, and real-font integration.

## 2. Draft Contracts and Fixture Schema

- [x] 2.1 Add documented draft TypeScript contracts for UTF-16 ranges, font metrics and keys, resolved shaped runs, positioned glyph references, line records, caret stops, bounds, selection queries, and normalized layout results without adding a production layout function.
- [x] 2.2 Define a versioned JSON fixture schema carrying intent, tags, synthetic input, resolved runs, expected results, evidence provenance, classification, and rationale.
- [x] 2.3 Implement validation-only fixture loading and canonical numeric serialization that rejects non-finite values, normalizes negative zero, enforces the documented precision, and reports stable case-local errors.
- [x] 2.4 Add invariant tests for UTF-16 and surrogate boundaries, half-open range coverage, glyph/line/font references, opcode-free renderer-neutral data, finite bounds, caret boundaries, and deterministic serialization.

## 3. Synthetic Line-Construction Fixtures

- [x] 3.1 Capture focused fixtures for CRLF/CR/LF normalization, consecutive and trailing line breaks, empty input, explicit empty lines, trailing whitespace, and block-width policy.
- [x] 3.2 Capture normal-wrap, no-wrap, break-word, unbreakable-run, soft-break, hard-break, finite-width, and indentation fixtures with explicit line ranges and break metadata.
- [x] 3.3 Capture letter-spacing, normal and explicit line-height, mixed ascender/descender metrics, mixed font sizes, and baseline-selection fixtures using controlled numeric shaped runs.

## 4. Synthetic Placement and Bounds Fixtures

- [x] 4.1 Capture left, center, right, and justified alignment fixtures, including distributable versus trailing whitespace and the accepted order of width calculations.
- [x] 4.2 Capture numeric, keyword, and percentage horizontal/vertical anchor fixtures proving consistent translation of glyphs, lines, carets, selections, block bounds, and visible bounds.
- [x] 4.3 Capture LTR, RTL, and mixed-direction visual-placement fixtures across single and wrapped lines while retaining logical UTF-16 source ranges.
- [x] 4.4 Capture style, language, size, variation, and grapheme-safe fallback font-boundary fixtures with stable font keys and line metrics from all participating runs.
- [x] 4.5 Capture block-versus-visible bounds for whitespace, empty results, overhangs, mixed sizes, and alternate fixture grouping, proving bounds are independent of renderer chunks.

## 5. Interaction Geometry Fixtures

- [x] 5.1 Capture caret-stop fixtures for ordinary characters, ligatures, combining sequences, reordered runs, supplementary-plane text, line boundaries, and empty lines without surrogate-splitting positions.
- [x] 5.2 Capture expected pure selection rectangles for forward, reversed, empty, clipped, multiline, ligature, combining, and mixed-bidi source ranges in deterministic visual order.
- [x] 5.3 Add fixture-level checks that selection rectangles are finite, non-overlapping after normalization, line-associated, and derivable solely from accepted line and caret data.

## 6. Troika Observation Classification

- [x] 6.1 Capture normalized Troika observations for the applicable fixture cases from the pinned ignored checkout, excluding glyph paths, SDF/atlas data, worker state, timings, and renderer chunking.
- [x] 6.2 Create the validation report mapping every fixture to `preserve`, `intentional-change`, or `defer`, with a rationale and reference source area for each classification.
- [x] 6.3 Add completeness validation that fails on missing provenance, unknown classifications, missing rationales, duplicate case IDs, or unclassified committed observations.
- [x] 6.4 Verify all normal workspace checks consume only committed normalized fixtures and continue to pass when the `old/` checkout is unavailable.

## 7. Public Font Integration Evidence

- [x] 7.1 Add only the workspace dependency and test utilities required for layout validation to load pinned fixtures through the public `@webgpu-text/font` entry point.
- [x] 7.2 Record explicit run plans and shaped-run translations for Latin, Arabic, Devanagari, Khmer, combining-mark, supplementary-plane, fallback-font, variable-axis, and mixed-direction cases.
- [x] 7.3 Add tests proving real glyph IDs, UTF-16 clusters, advances, offsets, flags, variations, and stable font keys populate the draft resolved-run contract without importing font internals.
- [x] 7.4 Prove synthetic policy fixtures remain independent by changing or substituting a real-font observation in the harness without rewriting policy expectations.

## 8. Documentation and Verification

- [x] 8.1 Document the fixture format, evidence layers, reference-capture procedure, draft contract, accepted behaviors, intentional differences, deferred behavior, and handoff requirements for `implement-text-layout-core`.
- [x] 8.2 Update `ARCHITECTURE.md` and `ROADMAP.md` to mark the repository baseline and font core complete and record the validated layout-policy boundary as the next production input without claiming that itemization or layout is implemented.
- [x] 8.3 Run layout and workspace formatting, type checking, tests, and builds; validate fixture/classification determinism without `old/`; check forbidden higher-layer and reference imports; and run `openspec validate capture-layout-policy-fixtures`, resolving all failures.

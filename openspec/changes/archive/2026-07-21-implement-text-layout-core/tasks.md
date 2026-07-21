## 1. Production Contracts and Evidence Migration

- [x] 1.1 Replace the draft policy input with documented production `ResolvedLayoutInput` types, adding paragraph level, per-run effective layout-unit metrics, per-run bidi level, and stable font/glyph/variation references.
- [x] 1.2 Add and export `InvalidLayoutInputError`, `layoutResolvedText()`, and the production selection-helper signature without exposing font handles, outlines, workers, or renderer types.
- [x] 1.3 Mechanically migrate synthetic fixture inputs to per-run effective metrics and explicit bidi levels while proving every previously accepted expected result remains semantically unchanged.
- [x] 1.4 Strengthen the mixed-direction fixture evidence with multiple glyphs and run levels sufficient to fail on run-order reversal or RTL double reversal.
- [x] 1.5 Update fixture validation and canonicalization for the production layout-unit and bidi contracts, including finite run metrics, paragraph/run level parity, and stable case-local errors.

## 2. Input Validation and Internal Model

- [x] 2.1 Implement public resolved-input validation for option values, UTF-16/surrogate boundaries, run ordering/coverage, glyph-cluster containment, direction-level parity, non-empty font keys, and finite measurements.
- [x] 2.2 Add invalid-input tests covering malformed ranges, unresolved required text, empty font keys, overlapping runs, invalid levels, non-finite values, and input immutability on failure.
- [x] 2.3 Build the private resolved run/cluster representation, grouping same-range glyphs without losing effective metrics, flags, offsets, style, language, variations, or logical source identity.
- [x] 2.4 Derive stable grapheme boundaries with native `Intl.Segmenter` and intersect them with shaped-cluster boundaries for caret and break-word safety.

## 3. Line Construction

- [x] 3.1 Implement original-index-preserving CRLF, CR, and LF scanning plus deterministic empty-input, consecutive-break, trailing-break, and explicit-empty-line records.
- [x] 3.2 Implement logical width accumulation with scaled advances, cluster-level letter spacing, first-line indentation, whitespace tracking, and mixed-run line metrics.
- [x] 3.3 Implement normal soft wrapping at the last accepted whitespace opportunity, preserving trailing whitespace in logical ranges while excluding it from aligned content width.
- [x] 3.4 Implement no-wrap and unbreakable overflow behavior plus break-word fallback restricted to shared grapheme/cluster boundaries.
- [x] 3.5 Add focused production tests for hard/soft break metadata, line ranges, widths, indentation, spacing, normal/explicit line height, mixed metrics, and overflow modes.

## 4. Visual Placement

- [x] 4.1 Split resolved runs into line-local shaped fragments and implement UAX #9 L2 level reordering over fragments without reversing HarfBuzz glyph order within a fragment.
- [x] 4.2 Position scaled LTR and RTL glyphs in visual order while preserving logical UTF-16 ranges, run metadata, advances, offsets, and stable output glyph references.
- [x] 4.3 Implement left, center, and right alignment from accepted content widths.
- [x] 4.4 Implement justification over eligible non-trailing whitespace and verify the accepted width-calculation order.
- [x] 4.5 Add focused placement tests for mixed-direction multiline runs, nested levels, styles, sizes, languages, variations, fallback font keys, alignment, and justification.

## 5. Bounds and Interaction Geometry

- [x] 5.1 Calculate line and block bounds from layout extents and optional visible bounds from scaled supplied glyph bounds, including empty, whitespace-only, overhang, mixed-size, and grouping-independent cases.
- [x] 5.2 Generate logical-order caret stops for ordinary clusters, interpolated ligature graphemes, combining sequences, supplementary-plane text, RTL runs, line boundaries, and empty lines without invalid UTF-16 positions.
- [x] 5.3 Promote selection derivation into `getSelectionRects()`, normalizing and clipping ranges and producing finite merged per-line rectangles in deterministic visual order.
- [x] 5.4 Apply numeric, keyword, and percentage anchors once to glyphs, lines, carets, block/visible bounds, and derived selection geometry.
- [x] 5.5 Add interaction tests for forward, reversed, empty, clipped, multiline, ligature, combining, supplementary, and mixed-direction ranges plus consistent anchor translation.

## 6. Conformance and Public Integration

- [x] 6.1 Replace validation-only snapshot assertions with a conformance harness that passes every synthetic fixture input through public `layoutResolvedText()` and compares the complete semantic result.
- [x] 6.2 Add public `@webgpu-text/font` integration smoke tests that translate representative pinned shaped runs into valid resolved layout input without importing font internals or making real-font output the policy oracle.
- [x] 6.3 Add determinism and immutability tests proving repeated layout and selection calls return equal results without changing caller-owned input or prior results.
- [x] 6.4 Add boundary checks proving production layout source imports no `old/`, experiments, SDF, Three.js, DOM, atlas, GPU, worker, or font-internal module.

## 7. Documentation and Verification

- [x] 7.1 Update the package README with the resolved-run API, complete unit model, minimal examples, error behavior, supported break policy, and explicit itemization/line-breaking limitations.
- [x] 7.2 Update `ARCHITECTURE.md`, `ROADMAP.md`, and the layout validation handoff to mark only the resolved layout core implemented and keep provider, automatic itemization/fallback, complete Unicode line breaking, reshaping, workers, and bidi affinity explicit follow-ups.
- [x] 7.3 Verify package-install ESM/type exports for the production API without adding a runtime dependency.
- [x] 7.4 Run fixture regeneration determinism, layout and workspace formatting/typecheck/tests/builds without `old/`, forbidden-import checks, and `openspec validate implement-text-layout-core`, resolving every failure.

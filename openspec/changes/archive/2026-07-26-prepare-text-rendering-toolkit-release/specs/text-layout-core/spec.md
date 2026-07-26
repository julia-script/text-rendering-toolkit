## MODIFIED Requirements

### Requirement: Expose a pure resolved-run layout API
`@text-rendering-toolkit/layout` SHALL expose a synchronous `layoutResolvedText()` operation that accepts text, layout policy, scaled font metadata, an explicit font-unit-to-layout-unit scale, explicitly resolved shaped runs, and optional explicit UTF-16 soft-break opportunities and returns a renderer-neutral `LayoutResult` without fetching, shaping, mutating, or disposing fonts.

#### Scenario: Lay out valid resolved text
- **WHEN** a caller supplies valid multilingual resolved input with omitted or explicit soft-break opportunities
- **THEN** the operation returns positioned glyph references with their font keys, glyph IDs, variations, placement, and font-unit scales plus line records, caret stops, block bounds, and visible bounds using only the supplied data

#### Scenario: Preserve the existing expert default
- **WHEN** an existing caller omits explicit soft-break opportunities
- **THEN** the resolved core retains its accepted whitespace, hard-break, and emergency break-word behavior without acquiring raw-text preparation or a runtime line-breaking dependency

#### Scenario: Repeat a layout
- **WHEN** the same immutable input is laid out repeatedly
- **THEN** each semantic result is identical and the input remains unchanged

### Requirement: Keep decoration derivation post-layout
`@text-rendering-toolkit/layout` SHALL expose decoration derivation as a pure synchronous operation over an existing `LayoutResult` and independent decoration spans, without rerunning preparation, font selection, shaping, line breaking, bidi placement, caret construction, or selection construction.

#### Scenario: Change appearance only
- **WHEN** a caller changes only decoration kind, style, color, thickness, offset, skip-ink, or clipping for an existing result
- **THEN** derivation reuses the same glyphs, lines, carets, selections, font identities, and prepared-text identity

#### Scenario: Reject an invalid span
- **WHEN** a decoration span is empty, outside the source, splits a UTF-16 surrogate pair or editable grapheme, uses an unsupported kind/style combination, or contains invalid numeric or color data
- **THEN** derivation throws the public layout-input error without returning partial segments or mutating the layout

#### Scenario: Derive repeatedly
- **WHEN** the same immutable result and decoration inputs are derived repeatedly
- **THEN** every semantic segment and aggregate decoration bound is identical and all inputs remain unchanged

### Requirement: Conform to accepted evidence without higher layers
The production implementation MUST satisfy the committed synthetic
layout-policy corpus, explicit-opportunity fixtures, and public-font boundary
observations without importing the ignored reference checkout, font internals,
SDF code, Three.js, DOM APIs, or renderer data.

#### Scenario: Execute policy conformance
- **WHEN** the committed synthetic legacy and explicit-opportunity cases are passed to `layoutResolvedText()`
- **THEN** production results match their accepted semantic expectations after any explicitly documented contract-unit migration

#### Scenario: Exercise public-font data
- **WHEN** explicit runs are shaped through the public `@text-rendering-toolkit/font` API and translated into resolved layout input
- **THEN** the layout core accepts their glyph IDs, UTF-16 clusters, advances, offsets, flags, variations, stable font keys, and valid explicit opportunities without importing font internals

#### Scenario: Run in a clean workspace
- **WHEN** workspace formatting, type checking, tests, and builds run without `old/`
- **THEN** the production layout package passes with no browser, GPU, SDF, atlas, or Three.js requirement

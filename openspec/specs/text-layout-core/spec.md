# text-layout-core Specification

## Purpose

Define the pure, renderer-neutral resolved-run text layout contract, including
validation, line construction, visual placement, bounds, and interaction
geometry.

## Requirements

### Requirement: Expose a pure resolved-run layout API
`@webgpu-text/layout` SHALL expose a synchronous `layoutResolvedText()` operation that accepts text, layout policy, scaled font metadata, an explicit font-unit-to-layout-unit scale, explicitly resolved shaped runs, and optional explicit UTF-16 soft-break opportunities and returns a renderer-neutral `LayoutResult` without fetching, shaping, mutating, or disposing fonts.

#### Scenario: Lay out valid resolved text
- **WHEN** a caller supplies valid multilingual resolved input with omitted or explicit soft-break opportunities
- **THEN** the operation returns positioned glyph references with their font keys, glyph IDs, variations, placement, and font-unit scales plus line records, caret stops, block bounds, and visible bounds using only the supplied data

#### Scenario: Preserve the existing expert default
- **WHEN** an existing caller omits explicit soft-break opportunities
- **THEN** the resolved core retains its accepted whitespace, hard-break, and emergency break-word behavior without acquiring raw-text preparation or a runtime line-breaking dependency

#### Scenario: Repeat a layout
- **WHEN** the same immutable input is laid out repeatedly
- **THEN** each semantic result is identical and the input remains unchanged

### Requirement: Validate the production boundary
The layout operation MUST reject malformed or ambiguous resolved input with a public layout-input error before returning a partial result.

#### Scenario: Reject an invalid source boundary
- **WHEN** a run, glyph cluster, style range, break, explicit opportunity, or caret-producing boundary is outside the source, splits a UTF-16 surrogate pair, splits an editable grapheme, or falls inside a shaped cluster
- **THEN** layout fails with an error that identifies the invalid field and source range

#### Scenario: Reject inconsistent resolved data
- **WHEN** runs overlap illegally, leave required non-break text unresolved, reference unknown fonts, contain non-finite measurements, use invalid bidi levels, contain a non-positive or non-finite font-unit scale, or contain glyph clusters outside their run
- **THEN** layout fails deterministically without mutating the input

### Requirement: Construct lines from accepted policy
The layout core SHALL preserve original UTF-16 source identity while constructing
empty, hard-broken, soft-wrapped, unwrapped, and break-word lines according to
the accepted explicit-opportunity or legacy-whitespace policy, width,
indentation, letter-spacing, and line height.

#### Scenario: Preserve hard-break source ranges
- **WHEN** text contains CRLF, CR, LF, consecutive breaks, a trailing break, or no content
- **THEN** line records preserve original source offsets, treat CRLF as one hard break, and retain the accepted editable empty lines

#### Scenario: Wrap at an explicit soft opportunity
- **WHEN** normal wrapping with explicit opportunities exceeds a finite maximum width
- **THEN** the core chooses the last supplied opportunity that fits, records a soft break, and excludes trailing wrap whitespace from aligned content width while retaining its logical range

#### Scenario: Preserve legacy whitespace wrapping
- **WHEN** a resolved expert caller omits explicit opportunities and normal wrapping exceeds a finite maximum width
- **THEN** the core chooses the last accepted whitespace opportunity with its existing trailing-whitespace behavior

#### Scenario: Handle unbreakable overflow
- **WHEN** an unbreakable cluster sequence exceeds the maximum width
- **THEN** normal and no-wrap policy preserve the sequence while break-word policy may split only at a valid shaped-cluster and grapheme boundary

### Requirement: Place resolved glyphs consistently
The layout core SHALL interpret resolved run metrics, glyph advances, offsets, and optional glyph bounds as effective layout-unit values, SHALL apply no hidden font-unit scaling, and SHALL preserve each run's explicit `fontUnitScale` on every positioned glyph it produces.

#### Scenario: Combine fonts and sizes on one line
- **WHEN** a line contains runs with different fonts, metrics, sizes, variations, languages, or styles
- **THEN** every glyph retains its resolved measurements and font-unit scale and the line extents and baseline include all participating run metrics

#### Scenario: Apply spacing and line height
- **WHEN** letter spacing and normal or explicit line height are present
- **THEN** cluster advances, baselines, line extents, and block bounds follow the accepted order of operations without changing any positioned glyph's font-unit scale

#### Scenario: Reuse a result in a renderer
- **WHEN** a consumer resolves a positioned glyph's numeric outline through its font key and glyph ID
- **THEN** multiplying that font-unit outline by the positioned glyph's `fontUnitScale` maps it into the same layout-unit coordinate system as the glyph placement

### Requirement: Apply visual-order and alignment policy
Resolved input SHALL carry a paragraph bidi level and a bidi level for each shaped run, and the layout core SHALL place shaped run fragments in visual order per line before applying alignment, justification, and anchors.

#### Scenario: Place mixed-direction runs
- **WHEN** a line contains LTR and RTL shaped runs with explicit bidi levels
- **THEN** run fragments are reordered by level while glyphs retain their logical UTF-16 ranges and the direction-local order produced by shaping

#### Scenario: Align and justify a line
- **WHEN** a line uses left, center, right, or justified alignment
- **THEN** placement uses the accepted content width and distributes only eligible non-trailing whitespace

#### Scenario: Translate by anchors
- **WHEN** numeric, keyword, or percentage horizontal or vertical anchors are supplied
- **THEN** glyphs, lines, carets, block bounds, visible bounds, and derived selections receive the same translation

### Requirement: Produce renderer-neutral bounds
The layout core SHALL calculate block, line, and optional visible glyph bounds solely from scaled layout data and supplied glyph bounds.

#### Scenario: Calculate visible bounds
- **WHEN** one or more positioned glyphs provide finite bounds
- **THEN** visible bounds enclose their translated visible geometry without whitespace, atlas padding, or renderer grouping

#### Scenario: Omit unknown visible bounds
- **WHEN** no positioned glyph has supplied bounds
- **THEN** visible bounds are `null` while block and line bounds remain available

### Requirement: Produce interaction geometry
The layout core SHALL emit caret stops at accepted editable grapheme boundaries and SHALL expose a pure selection helper that derives deterministic rectangles from a `LayoutResult` and a normalized UTF-16 range.

#### Scenario: Create cluster-safe carets
- **WHEN** text contains ligatures, combining sequences, supplementary-plane characters, line boundaries, empty lines, or reordered runs
- **THEN** caret stops remain line-associated and do not split surrogate pairs or grapheme clusters

#### Scenario: Derive a selection
- **WHEN** a caller requests forward, reversed, clipped, empty, multiline, ligature, combining, or mixed-direction selection geometry
- **THEN** the helper returns finite non-overlapping rectangles in deterministic visual order using only result line and caret data

### Requirement: Retain scaled decoration metric context
The resolved layout input SHALL accept scaled underline and strikethrough metrics with each resolved run and its default metrics, and `LayoutResult` SHALL retain the minimum immutable source-range metric context needed to resolve automatic decorations after layout.

#### Scenario: Retain mixed font and size metrics
- **WHEN** one layout contains adjacent runs with different fonts, sizes, or decoration metrics
- **THEN** the result retains their scaled metric values and half-open UTF-16 ownership without embedding font handles, outlines, or renderer data

#### Scenario: Carry public font facts through raw layout
- **WHEN** `layoutPreparedText()` or `layoutText()` shapes caller-owned fonts at their requested sizes
- **THEN** it scales the public font decoration facts once into the same layout-unit coordinate system as run placement

#### Scenario: Preserve resolved expert input validation
- **WHEN** a resolved run or default metric supplies a non-finite position or a non-positive or non-finite thickness
- **THEN** `layoutResolvedText()` rejects the invalid field before returning a partial result

### Requirement: Keep decoration derivation post-layout
`@webgpu-text/layout` SHALL expose decoration derivation as a pure synchronous operation over an existing `LayoutResult` and independent decoration spans, without rerunning preparation, font selection, shaping, line breaking, bidi placement, caret construction, or selection construction.

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
- **WHEN** explicit runs are shaped through the public `@webgpu-text/font` API and translated into resolved layout input
- **THEN** the layout core accepts their glyph IDs, UTF-16 clusters, advances, offsets, flags, variations, stable font keys, and valid explicit opportunities without importing font internals

#### Scenario: Run in a clean workspace
- **WHEN** workspace formatting, type checking, tests, and builds run without `old/`
- **THEN** the production layout package passes with no browser, GPU, SDF, atlas, or Three.js requirement

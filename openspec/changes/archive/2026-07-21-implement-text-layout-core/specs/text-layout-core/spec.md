## ADDED Requirements

### Requirement: Expose a pure resolved-run layout API
`@webgpu-text/layout` SHALL expose a synchronous `layoutResolvedText()` operation that accepts text, layout policy, scaled font metadata, and explicitly resolved shaped runs and returns a renderer-neutral `LayoutResult` without fetching, shaping, mutating, or disposing fonts.

#### Scenario: Lay out valid resolved text
- **WHEN** a caller supplies a valid resolved input
- **THEN** the operation returns positioned glyph references, line records, caret stops, block bounds, and visible bounds using only the supplied data

#### Scenario: Repeat a layout
- **WHEN** the same immutable input is laid out repeatedly
- **THEN** each semantic result is identical and the input remains unchanged

### Requirement: Validate the production boundary
The layout operation MUST reject malformed or ambiguous resolved input with a public layout-input error before returning a partial result.

#### Scenario: Reject an invalid source boundary
- **WHEN** a run, glyph cluster, style range, break, or caret-producing boundary is outside the source or splits a UTF-16 surrogate pair
- **THEN** layout fails with an error that identifies the invalid field and source range

#### Scenario: Reject inconsistent resolved data
- **WHEN** runs overlap illegally, leave required non-break text unresolved, reference unknown fonts, contain non-finite measurements, use invalid bidi levels, or contain glyph clusters outside their run
- **THEN** layout fails deterministically without mutating the input

### Requirement: Construct lines from accepted policy
The layout core SHALL preserve original UTF-16 source identity while constructing empty, hard-broken, soft-wrapped, unwrapped, and break-word lines according to the accepted whitespace, width, indentation, letter-spacing, and line-height policy.

#### Scenario: Preserve hard-break source ranges
- **WHEN** text contains CRLF, CR, LF, consecutive breaks, a trailing break, or no content
- **THEN** line records preserve original source offsets, treat CRLF as one hard break, and retain the accepted editable empty lines

#### Scenario: Wrap at an accepted soft opportunity
- **WHEN** normal whitespace wrapping exceeds a finite maximum width
- **THEN** the core chooses the last accepted soft opportunity, records a soft break, and excludes trailing wrap whitespace from aligned content width while retaining its logical range

#### Scenario: Handle unbreakable overflow
- **WHEN** an unbreakable cluster sequence exceeds the maximum width
- **THEN** normal and no-wrap policy preserve the sequence while break-word policy may split only at a valid shaped-cluster and grapheme boundary

### Requirement: Place resolved glyphs consistently
The layout core SHALL interpret resolved run metrics, glyph advances, offsets, and optional glyph bounds as effective layout-unit values and SHALL apply no hidden font-unit scaling.

#### Scenario: Combine fonts and sizes on one line
- **WHEN** a line contains runs with different fonts, metrics, sizes, variations, languages, or styles
- **THEN** every glyph retains its resolved measurements and the line extents and baseline include all participating run metrics

#### Scenario: Apply spacing and line height
- **WHEN** letter spacing and normal or explicit line height are present
- **THEN** cluster advances, baselines, line extents, and block bounds follow the accepted order of operations

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

### Requirement: Conform to accepted evidence without higher layers
The production implementation MUST satisfy the committed synthetic layout-policy corpus and public-font boundary observations without importing the ignored reference checkout, font internals, SDF code, Three.js, DOM APIs, or renderer data.

#### Scenario: Execute policy conformance
- **WHEN** the committed synthetic cases are passed to `layoutResolvedText()`
- **THEN** production results match their accepted semantic expectations after any explicitly documented contract-unit migration

#### Scenario: Exercise public-font data
- **WHEN** explicit runs are shaped through the public `@webgpu-text/font` API and translated into resolved layout input
- **THEN** the layout core accepts their glyph IDs, UTF-16 clusters, advances, offsets, flags, variations, and stable font keys without importing font internals

#### Scenario: Run in a clean workspace
- **WHEN** workspace formatting, type checking, tests, and builds run without `old/`
- **THEN** the production layout package passes with no browser, GPU, SDF, atlas, or Three.js requirement

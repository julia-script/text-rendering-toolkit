## MODIFIED Requirements

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

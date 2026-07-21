## MODIFIED Requirements

### Requirement: Expose a pure resolved-run layout API
`@webgpu-text/layout` SHALL expose a synchronous `layoutResolvedText()` operation that accepts text, layout policy, scaled font metadata, an explicit font-unit-to-layout-unit scale, and explicitly resolved shaped runs and returns a renderer-neutral `LayoutResult` without fetching, shaping, mutating, or disposing fonts.

#### Scenario: Lay out valid resolved text
- **WHEN** a caller supplies a valid resolved input
- **THEN** the operation returns positioned glyph references with their font keys, glyph IDs, variations, placement, and font-unit scales plus line records, caret stops, block bounds, and visible bounds using only the supplied data

#### Scenario: Repeat a layout
- **WHEN** the same immutable input is laid out repeatedly
- **THEN** each semantic result is identical and the input remains unchanged

### Requirement: Validate the production boundary
The layout operation MUST reject malformed or ambiguous resolved input with a public layout-input error before returning a partial result.

#### Scenario: Reject an invalid source boundary
- **WHEN** a run, glyph cluster, style range, break, or caret-producing boundary is outside the source or splits a UTF-16 surrogate pair
- **THEN** layout fails with an error that identifies the invalid field and source range

#### Scenario: Reject inconsistent resolved data
- **WHEN** runs overlap illegally, leave required non-break text unresolved, reference unknown fonts, contain non-finite measurements, use invalid bidi levels, contain a non-positive or non-finite font-unit scale, or contain glyph clusters outside their run
- **THEN** layout fails deterministically without mutating the input

### Requirement: Place resolved glyphs consistently
The layout core SHALL interpret resolved run metrics, glyph advances, offsets, and optional glyph bounds as effective layout-unit values, SHALL apply no hidden font-unit scaling, and SHALL preserve each run's explicit `fontUnitScale` on every positioned glyph it produces.

#### Scenario: Combine fonts and sizes on one line
- **WHEN** a line contains runs with different fonts, metrics, sizes, font-unit scales, variations, languages, or styles
- **THEN** every glyph retains its resolved measurements and font-unit scale and the line extents and baseline include all participating run metrics

#### Scenario: Apply spacing and line height
- **WHEN** letter spacing and normal or explicit line height are present
- **THEN** cluster advances, baselines, line extents, and block bounds follow the accepted order of operations without changing any positioned glyph's font-unit scale

#### Scenario: Reuse a result in a renderer
- **WHEN** a consumer resolves a positioned glyph's numeric outline through its font key and glyph ID
- **THEN** multiplying that font-unit outline by the positioned glyph's `fontUnitScale` maps it into the same layout-unit coordinate system as the glyph placement

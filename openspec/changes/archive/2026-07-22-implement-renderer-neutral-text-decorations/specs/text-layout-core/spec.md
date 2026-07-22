## ADDED Requirements

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

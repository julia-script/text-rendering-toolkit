## MODIFIED Requirements

### Requirement: Expose a pure numeric-outline SDF API
`@text-rendering-toolkit/sdf` SHALL expose a synchronous `generateSdf()` operation that accepts numeric path commands and explicit rasterization options and returns a renderer-neutral `SdfBitmap` without parsing SVG, accessing a font, or mutating caller-owned input.

#### Scenario: Generate a bitmap
- **WHEN** a caller supplies a valid outline, view box, bitmap size, maximum distance, and exponent
- **THEN** the operation returns the requested dimensions, a one-channel `Uint8Array` of exactly `width * height` pixels, and the view-box and encoding metadata needed by a consumer

#### Scenario: Repeat generation
- **WHEN** the same immutable input is generated repeatedly
- **THEN** every returned pixel and metadata value is identical and the input arrays remain unchanged

### Requirement: Use a small structurally compatible outline contract
The SDF package SHALL accept move, line, quadratic, cubic, and close commands through numeric command and coordinate arrays whose structure is directly assignable from a public `@text-rendering-toolkit/font` `GlyphOutline`, without importing the font package at runtime.

#### Scenario: Consume a public font outline
- **WHEN** a caller passes the numeric command and coordinate arrays returned by `FontHandle.getOutline()` with an explicit SDF view box
- **THEN** `generateSdf()` consumes them directly without an SVG string conversion or a font-internal import

#### Scenario: Rasterize curves and contours
- **WHEN** an outline contains quadratic or cubic curves, multiple closed contours, reversed winding for a hole, or zero-length drawing commands
- **THEN** the generator produces deterministic segments, ignores segments with no length, and applies non-zero winding consistently

### Requirement: Protect behavior with independent evidence layers
The production implementation MUST use committed synthetic golden fixtures as its pixel-policy oracle and public-font outlines only as cross-package compatibility evidence.

#### Scenario: Execute synthetic conformance
- **WHEN** committed fixtures for lines, quadratic and cubic curves, holes, winding, padding, clipping, empty geometry, and multiple encoding exponents are passed to `generateSdf()`
- **THEN** the complete bitmap bytes and metadata match their reviewed expectations exactly

#### Scenario: Exercise real font outlines
- **WHEN** representative public `@text-rendering-toolkit/font` outlines are passed through the structural seam
- **THEN** generation succeeds deterministically with valid dimensions and byte ranges without treating font-revision-specific pixels as normative policy

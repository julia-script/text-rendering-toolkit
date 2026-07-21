# cpu-sdf-core Specification

## Purpose

Define the pure, attributed, renderer-neutral CPU contract for converting typed
numeric outlines into deterministic one-channel signed-distance-field pixels.

## Requirements

### Requirement: Expose a pure numeric-outline SDF API
`@webgpu-text/sdf` SHALL expose a synchronous `generateSdf()` operation that accepts numeric path commands and explicit rasterization options and returns a renderer-neutral `SdfBitmap` without parsing SVG, accessing a font, or mutating caller-owned input.

#### Scenario: Generate a bitmap
- **WHEN** a caller supplies a valid outline, view box, bitmap size, maximum distance, and exponent
- **THEN** the operation returns the requested dimensions, a one-channel `Uint8Array` of exactly `width * height` pixels, and the view-box and encoding metadata needed by a consumer

#### Scenario: Repeat generation
- **WHEN** the same immutable input is generated repeatedly
- **THEN** every returned pixel and metadata value is identical and the input arrays remain unchanged

### Requirement: Use a small structurally compatible outline contract
The SDF package SHALL accept move, line, quadratic, cubic, and close commands through numeric command and coordinate arrays whose structure is directly assignable from a public `@webgpu-text/font` `GlyphOutline`, without importing the font package at runtime.

#### Scenario: Consume a public font outline
- **WHEN** a caller passes the numeric command and coordinate arrays returned by `FontHandle.getOutline()` with an explicit SDF view box
- **THEN** `generateSdf()` consumes them directly without an SVG string conversion or a font-internal import

#### Scenario: Rasterize curves and contours
- **WHEN** an outline contains quadratic or cubic curves, multiple closed contours, reversed winding for a hole, or zero-length drawing commands
- **THEN** the generator produces deterministic segments, ignores segments with no length, and applies non-zero winding consistently

### Requirement: Validate the production boundary
The package MUST reject malformed or unsafe generation input with a public `InvalidSdfInputError` before allocating or returning a partial bitmap.

#### Scenario: Reject invalid dimensions or encoding
- **WHEN** width or height is not a positive safe integer, their product cannot be allocated safely, the view box is non-finite or inverted, or distance or exponent is not finite and greater than zero
- **THEN** generation fails with an error identifying the invalid field

#### Scenario: Reject malformed outline data
- **WHEN** a command opcode is unknown, coordinate counts do not match commands, a coordinate is non-finite, a drawing command appears before a move, or a close command has no open contour
- **THEN** generation fails deterministically without mutating the outline arrays

### Requirement: Preserve the accepted signed-distance encoding
The generator SHALL sample each output texel at its center in view-box coordinates and encode the nearest signed distance using the accepted `webgl-sdf-generator@1.1.1` CPU policy, with values below the edge threshold outside and values above it inside.

#### Scenario: Encode an edge and distance limits
- **WHEN** texel centers lie on, inside, outside, or at least the maximum distance from a contour
- **THEN** the byte encoding uses the accepted exponential curve, rounds and clamps to `0...255`, maps the mathematical edge to the midpoint byte, and saturates at the distance limits

#### Scenario: Preserve pixel orientation
- **WHEN** a non-symmetric outline is generated
- **THEN** pixels are row-major, `pixels[y * width + x]` addresses one texel, and row zero samples the lower edge of the declared view box

### Requirement: Define empty and clipped geometry behavior
The generator SHALL return a valid bitmap for an empty or fully degenerate outline and SHALL evaluate complete supplied geometry even when contours extend outside the view box.

#### Scenario: Generate an empty outline
- **WHEN** the command arrays contain no drawable segment
- **THEN** every output pixel is the saturated outside value while dimensions and encoding metadata remain valid

#### Scenario: Generate clipped geometry
- **WHEN** part or all of a valid contour lies outside the view box
- **THEN** off-bitmap segments still contribute to nearest-distance and winding calculations for sampled texel centers

### Requirement: Protect behavior with independent evidence layers
The production implementation MUST use committed synthetic golden fixtures as its pixel-policy oracle and public-font outlines only as cross-package compatibility evidence.

#### Scenario: Execute synthetic conformance
- **WHEN** committed fixtures for lines, quadratic and cubic curves, holes, winding, padding, clipping, empty geometry, and multiple encoding exponents are passed to `generateSdf()`
- **THEN** the complete bitmap bytes and metadata match their reviewed expectations exactly

#### Scenario: Exercise real font outlines
- **WHEN** representative public `@webgpu-text/font` outlines are passed through the structural seam
- **THEN** generation succeeds deterministically with valid dimensions and byte ranges without treating font-revision-specific pixels as normative policy

### Requirement: Remain independent and attributed
The published SDF package MUST be ESM-only, preserve the required MIT attribution for its adapted CPU algorithm, and contain no runtime dependency on `old/`, `webgl-sdf-generator`, fonts, layout, workers, DOM, canvas, WebGL, WebGPU, Three.js, or atlas code.

#### Scenario: Install the package independently
- **WHEN** the packed package is installed in a clean ESM and TypeScript consumer
- **THEN** `generateSdf()`, its error type, and public data types resolve and run without another workspace package or browser global

#### Scenario: Audit provenance and boundaries
- **WHEN** package contents, imports, notices, and ordinary workspace checks are inspected without `old/`
- **THEN** the adapted source identifies `webgl-sdf-generator@1.1.1`, its package integrity and copyright notice, and contains none of the excluded higher-layer modules or APIs

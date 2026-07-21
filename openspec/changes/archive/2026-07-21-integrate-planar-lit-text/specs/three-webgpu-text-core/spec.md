## ADDED Requirements

### Requirement: Choose planar lighting at construction
`@webgpu-text/three` SHALL let a caller choose the existing unlit material or one
dedicated planar standard material when constructing `Text`, and SHALL keep that
choice fixed for the object's lifetime.

#### Scenario: Preserve the unlit default
- **WHEN** a caller constructs `Text` without a lit option or explicitly disables it
- **THEN** the mesh uses the existing unlit node material and retains its accepted rendering behavior

#### Scenario: Construct planar lit text
- **WHEN** a caller constructs `Text` with the lit option enabled
- **THEN** the mesh uses a standard node material with fixed planar normals and the same completed-layout, font-registry, atlas, appearance, synchronization, and ownership boundaries as unlit text

#### Scenario: Keep material kind immutable
- **WHEN** layout or mutable appearance properties change and the caller synchronizes again
- **THEN** the existing construction-selected material object is updated in place and is not replaced with another material kind

### Requirement: Render planar lit SDF text through public TSL nodes
The planar lit variant MUST bind the production glyph position, color, clipped
SDF opacity, and shadow mask to a transparent non-metallic standard node material
using only public Three.js WebGPU and TSL surfaces.

#### Scenario: Respond to scene light
- **WHEN** front-facing lit text is rendered with and without a supported scene light
- **THEN** filled glyph regions show a measurable lighting response while intended colors, antialiased boundaries, clipped regions, and transparent exteriors remain valid

#### Scenario: Cast glyph-shaped shadows
- **WHEN** the caller enables `castShadow` and places lit text between a supported light and receiver
- **THEN** shadows follow positioned filled-glyph coverage and preserve transparent quad margins and glyph cutouts without duplicate shadow geometry

#### Scenario: Receive a scene shadow
- **WHEN** the caller enables `receiveShadow` and an external occluder shadows part of lit text
- **THEN** visible glyph-interior pixels respond to the shadow while transparent glyph-exterior pixels remain clear

#### Scenario: Render without shadow participation
- **WHEN** lit text is used with cast or receive flags disabled
- **THEN** its ordinary standard-material SDF rendering remains valid without requiring another geometry, atlas, or material path

## MODIFIED Requirements

### Requirement: Provide independent package and actual-WebGPU evidence
The production renderer MUST remain strict-TypeScript and ESM-only, consume
completed layout through public types, import only public lower-package and
Three.js surfaces, and provide deterministic unit, package, public-example, and
semantic browser evidence for both its unlit default and planar lit variant
without a dependency on `old/`, experiment internals, WebGL, or private
font/layout/SDF modules.

#### Scenario: Install the renderer package
- **WHEN** its packed artifact is installed in a clean ESM and TypeScript consumer with the declared Three peer
- **THEN** public unlit and lit values and types resolve with no workspace path, CommonJS, browser global at module evaluation, or undeclared dependency

#### Scenario: Run deterministic non-GPU checks
- **WHEN** ordinary workspace tests execute without a browser or GPU
- **THEN** atlas packing, growth, cache reuse, synchronization, failure atomicity, completed-layout consumption, material selection, planar normals, shadow-node wiring, and disposal checks pass deterministically

#### Scenario: Run the public WebGPU fixture
- **WHEN** the documented browser fixture prepares layout through the public layout API and renders the production standard variant with a usable WebGPU adapter
- **THEN** the real-font pipeline renders multiple atlas cells, preserves color and transparent coverage, responds to lighting, casts and receives glyph-confined shadows, validates a post-render update, and repeats disposal on the pinned backend

#### Scenario: Reject WebGL as evidence
- **WHEN** WebGPU is unavailable or Three selects its WebGL fallback
- **THEN** browser validation fails or reports the environment unsupported and MUST NOT count the frame as passing renderer evidence

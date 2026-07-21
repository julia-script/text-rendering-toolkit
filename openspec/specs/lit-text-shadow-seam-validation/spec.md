# lit-text-shadow-seam-validation Specification

## Purpose

Define the actual-WebGPU evidence required to validate planar lit SDF text,
glyph-shaped cast shadows, received shadows, public Three.js node-material
boundaries, and a bounded production handoff.

## Requirements

### Requirement: Isolate the lit rendering proof
The project SHALL evaluate lit SDF text in the private WebGPU rendering experiment using the existing fixed atlas and instanced glyph representation, without changing a publishable package or introducing a public material API.

#### Scenario: Construct the experimental lit mesh
- **WHEN** the experiment creates its lit text fixture
- **THEN** it uses the proven indexed unit quad, instanced bounds, flat RGBA atlas slots, normalized glyph colors, and SDF coverage model with a dedicated standard node material

#### Scenario: Preserve production boundaries
- **WHEN** the change is inspected or the workspace boundary checks run
- **THEN** no public package export, dependency direction, font/layout/SDF contract, or shipped unlit `Text` behavior has changed

### Requirement: Respond to scene lighting through public node APIs
The experimental material MUST use public Three.js WebGPU and node-material surfaces to render planar glyphs with fixed non-metallic standard-material controls, SDF antialiasing, and scene-light response without GLSL strings, shader rewriting, WebGL APIs, or private renderer imports.

#### Scenario: Compare illuminated and unilluminated glyphs
- **WHEN** the same front-facing glyph fixture is captured with and without its directional-light contribution
- **THEN** filled glyph regions exhibit a measurable lighting-dependent luminance difference while transparent exterior regions remain transparent

#### Scenario: Preserve glyph color and coverage
- **WHEN** differently colored glyph instances render under the lit material
- **THEN** their intended color separation and antialiased SDF boundaries remain observable rather than being replaced by opaque quad coverage

### Requirement: Cast glyph-shaped shadows
The experiment MUST prove that instanced SDF glyphs cast shadows from their visible glyph coverage and positions, not from the full rectangular instance quads.

#### Scenario: Cast onto a receiver
- **WHEN** a shadow-casting text mesh is placed between a supported shadow-casting light and a receiving surface
- **THEN** the surface contains a measurable shadow in projected filled-glyph regions and remains unshadowed in transparent quad margins and a known glyph cutout

#### Scenario: Preserve instanced placement in the shadow pass
- **WHEN** multiple glyph instances have distinct bounds or transforms
- **THEN** their projected shadow regions follow the same instanced placement used by the visible lit pass

### Requirement: Receive shadows on visible glyph coverage
The experiment SHALL prove that lit SDF text can receive scene shadows while keeping the shadow response confined to visible glyph coverage.

#### Scenario: Receive an occluder shadow
- **WHEN** an external occluder shadows only part of a lit text fixture
- **THEN** covered glyph-interior pixels are measurably darker than an unshadowed control region and transparent glyph exterior pixels remain clear

#### Scenario: Render without scene shadows
- **WHEN** the same material renders with shadow casting and receiving disabled
- **THEN** its ordinary lit SDF coverage remains valid without requiring a separate geometry or atlas representation

### Requirement: Capture reproducible actual-WebGPU evidence
The project MUST validate the seam on the pinned actual-WebGPU backend, preserve reproducible semantic evidence, and explicitly record whether the public hooks are sufficient for a bounded production follow-up.

#### Scenario: Run deterministic non-browser checks
- **WHEN** ordinary experiment tests execute without a GPU
- **THEN** the lit material graph's controls, SDF shadow mask, instanced attributes, prohibited-import boundaries, and disposal behavior are checked deterministically where observable

#### Scenario: Run the browser fixture
- **WHEN** the documented browser validation runs with a usable WebGPU adapter
- **THEN** lighting response, glyph-shaped cast shadows, received shadows, color separation, and transparent coverage pass tolerant semantic observations on the pinned Three.js revision

#### Scenario: Reject unsupported rendering evidence
- **WHEN** WebGPU is unavailable or Three.js selects a WebGL fallback
- **THEN** the validation fails or reports the environment unsupported and MUST NOT count the run as passing seam evidence

#### Scenario: Preserve reviewed evidence
- **WHEN** the seam validation passes
- **THEN** the repository contains one reviewed frame, machine-readable observations and environment revisions, exact reproduction commands, and an architecture/roadmap decision that separates proven behavior from deferred production work

# WebGPU Rendering Seam Validation Specification

## Purpose

Define the evidence required to validate the Three.js TSL/WebGPU rendering seam before promoting it into production renderer packages.

## Requirements

### Requirement: Provide an isolated WebGPU rendering experiment
The project SHALL provide a private strict-TypeScript, ESM-only experiment that validates the Three.js text-rendering seam without exporting a production API or depending on font loading, shaping, text layout, SDF generation, workers, or files under `old/`.

#### Scenario: Run the isolated experiment
- **WHEN** a contributor runs the documented validation command from a clean workspace install
- **THEN** the experiment builds and executes its fixture, browser-rendering, update, and lifecycle checks without requiring any unimplemented package capability

#### Scenario: Preserve public package boundaries
- **WHEN** a consumer imports any `@webgpu-text/*` package
- **THEN** no experiment module or provisional renderer-seam type is exposed through the package's public exports

### Requirement: Validate an actual WebGPU backend
The browser validation MUST require the WebGPU API, initialize the pinned Three.js renderer, and verify that the rendered evidence came from Three's WebGPU backend rather than its WebGL fallback.

#### Scenario: Render with WebGPU available
- **WHEN** the validation runs in its documented supported Chromium environment with a usable WebGPU adapter
- **THEN** renderer initialization completes, the selected backend is recorded as WebGPU, and the frame assertions execute

#### Scenario: Reject WebGL fallback as evidence
- **WHEN** WebGPU is unavailable or Three.js selects a WebGL backend
- **THEN** the validation fails or reports the environment as unsupported and MUST NOT record the rendered frame as a passing WebGPU result

### Requirement: Render deterministic instanced RGBA-atlas SDF fixtures
The experiment SHALL render multiple instanced glyph-like quads from deterministic typed instance data and a shared RGBA atlas in which separate SDF shapes occupy separate color channels.

#### Scenario: Select atlas channels per instance
- **WHEN** instances reference different channels in the same atlas cell
- **THEN** each instance displays the shape encoded in its requested channel without visible contribution from the other channels

#### Scenario: Place glyphs from bounds
- **WHEN** fixed instances contain distinct renderer-neutral bounds
- **THEN** one shared quad geometry produces the expected distinct screen-space positions and dimensions

### Requirement: Express baseline text appearance through TSL
The experiment MUST use TSL and a node material to decode signed distance and apply derivative antialiasing, per-glyph color, opacity, rectangular clipping, orientation, and cylindrical curvature without shader-string rewriting or WebGL-specific APIs.

#### Scenario: Render antialiased transparent coverage
- **WHEN** a glyph fixture crosses the signed-distance edge
- **THEN** targeted frame observations contain opaque interior coverage, transparent exterior coverage, and a bounded antialiased transition

#### Scenario: Render color and opacity
- **WHEN** instances use distinct colors and material opacity below one
- **THEN** targeted rendered regions preserve the selected colors and blend with the fixed background at the expected bounded opacity

#### Scenario: Apply clipping and placement transforms
- **WHEN** fixed fixture instances enable clipping, orientation, or cylindrical curvature
- **THEN** semantic frame observations show the expected clipped region and transformed bounds without changing unrelated instances

### Requirement: Propagate post-render resource updates
The experiment SHALL demonstrate that atlas pixel mutations and instance-attribute mutations made after an initial completed frame are visible in a subsequent completed frame.

#### Scenario: Upload changed atlas bytes
- **WHEN** one atlas channel is mutated in place and the texture is marked for update
- **THEN** the next frame changes the instance using that channel while instances using untouched channels remain stable

#### Scenario: Upload changed instance data
- **WHEN** selected instance bounds or colors are mutated and their attributes are marked for update
- **THEN** the next frame reflects those changes without recreating unrelated renderer resources

### Requirement: Produce reproducible semantic visual evidence
The validation SHALL use fixed rendering inputs and SHALL record a human-reviewable frame plus tolerant semantic observations that remain meaningful across reasonable GPU rasterization differences.

#### Scenario: Validate a rendered frame
- **WHEN** the browser test captures the fixed-size canvas
- **THEN** it verifies expected occupied and transparent regions, channel/color separation, transformed bounds, clipping, and edge transitions without requiring an exact whole-image hash

#### Scenario: Audit the environment and fixtures
- **WHEN** a contributor inspects the committed observations
- **THEN** they can identify the Three.js revision, browser, operating system, WebGPU adapter information available to the test, launch configuration, fixture provenance, and fixture integrity values

### Requirement: Validate renderer resource ownership
The experiment MUST explicitly dispose every owned Three.js and browser resource and MUST repeat the create-render-update-dispose lifecycle sufficiently to expose immediate reuse or disposal failures.

#### Scenario: Dispose one validation lifecycle
- **WHEN** a render/update cycle finishes
- **THEN** geometry, material, texture, renderer, DOM, and browser-test resources are released through their documented ownership boundaries

#### Scenario: Repeat after disposal
- **WHEN** the experiment creates and renders a second fixture after disposing the first
- **THEN** the second lifecycle completes without relying on resources retained by the first

### Requirement: Record an evidence-backed renderer decision
The change MUST produce a committed report that states whether the pinned Three.js TSL/WebGPU seam is viable, records any failed assumptions or unstable APIs, and recommends the smallest renderer input, geometry, material, atlas-update, backend-validation, and disposal boundaries for later production work.

#### Scenario: Complete a viable spike
- **WHEN** all required checks pass on a documented WebGPU environment
- **THEN** the report includes reproduction commands, observations, limitations, and promotion guidance, and the roadmap and architecture reflect the proven boundary

#### Scenario: Reject an unsuitable seam
- **WHEN** a required behavior cannot be demonstrated within the bounded experiment
- **THEN** the report identifies the failed behavior and a bounded alternative without silently implementing font, layout, SDF, or the full renderer package

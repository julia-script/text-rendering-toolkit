# Font Engine Validation Specification

## Purpose

Define the evidence required to validate HarfBuzzjs as the font and shaping engine behind the future renderer-neutral font boundary.

## Requirements

### Requirement: Provide an isolated executable validation harness
The project SHALL provide a strict-TypeScript, ESM-only harness that exercises the published HarfBuzzjs package without presenting the harness as the production `font` package or importing code from the ignored `old/` checkout.

#### Scenario: Run validation in Node
- **WHEN** a contributor runs the documented Node validation command from a clean install
- **THEN** the harness initializes HarfBuzzjs and completes its automated shaping, cluster, font-fact, outline, and format checks

#### Scenario: Run validation in a browser module worker
- **WHEN** the browser validation is run in a supported real browser
- **THEN** an ESM worker initializes HarfBuzzjs, shapes a sample, returns structured results, and terminates without depending on WebGL, WebGPU, Three.js, or DOM access inside the worker

### Requirement: Use representative and attributable font fixtures
The validation SHALL use redistributable fixtures that collectively exercise TrueType and CFF outlines plus Latin, Arabic, Indic, Khmer, combining-mark, and supplementary-plane text, and SHALL record each fixture's source, license, and integrity hash.

#### Scenario: Audit fixture provenance
- **WHEN** a contributor inspects the validation fixtures
- **THEN** every committed font file has recorded provenance, license terms compatible with repository use, and a reproducible integrity hash

### Requirement: Validate shaping at the run boundary
The harness SHALL shape explicit directional, script, and language runs and SHALL record deterministic glyph IDs, clusters, advances, and offsets for representative OpenType behavior including ligatures, kerning, joining, reordering, and mark positioning.

#### Scenario: Shape representative scripts
- **WHEN** the shaping matrix is executed with the pinned HarfBuzzjs version and fixtures
- **THEN** Latin, Arabic, Indic, and Khmer cases produce finite advances and offsets and match the accepted observations for that pinned engine and fixture set

#### Scenario: Keep paragraph layout outside HarfBuzz
- **WHEN** a mixed-direction sample is validated
- **THEN** the harness supplies explicit directional runs and demonstrates that paragraph bidi segmentation and visual line placement remain responsibilities of the future text-layout package

### Requirement: Preserve JavaScript source indexing
The HarfBuzz adapter experiment MUST expose cluster values as UTF-16 code-unit indices into the original JavaScript string and MUST demonstrate their behavior for ligatures, combining sequences, supplementary-plane characters, and right-to-left runs.

#### Scenario: Map shaped glyphs back to source text
- **WHEN** a validation case contains multi-code-unit or multi-code-point clusters
- **THEN** every returned cluster identifies a valid UTF-16 boundary in the original string and the report explains how later caret logic can associate glyphs with source ranges

### Requirement: Validate normalized font facts
The harness SHALL demonstrate the HarfBuzzjs operations required to expose a renderer-neutral font handle with units-per-em, extents or equivalent line metrics, character-to-glyph coverage, glyph advances, and variation coordinates where supported by a fixture.

#### Scenario: Query facts without exposing WASM pointers
- **WHEN** the harness loads a representative font
- **THEN** it emits normalized serializable font facts sufficient to assess the provisional `FontHandle` boundary without exposing HarfBuzz or Emscripten pointers

### Requirement: Validate lazy numeric outline feasibility
The adapter experiment MUST require direct HarfBuzz drawing callbacks for renderer-neutral numeric outlines and MUST reject an SVG construction/reparse path. If the published wrapper does not expose the required callback surface, the experiment MUST record that failed assumption and a bounded alternative rather than presenting the fallback as compliant.

#### Scenario: Reject a non-numeric public path
- **WHEN** the pinned published wrapper exposes only SVG-string outline convenience methods
- **THEN** the candidate direct-outline operation fails explicitly, the diagnostic path is labeled non-compliant, and the report identifies the smallest direct-callback follow-up

#### Scenario: Preserve the target cache contract
- **WHEN** the future direct callback bridge is designed
- **THEN** its target cache key includes font identity, variation coordinates, and glyph ID, and no SVG path is part of the public contract

### Requirement: Characterize formats, startup, and memory behavior
The validation SHALL record the exact HarfBuzzjs and embedded HarfBuzz versions, distributable artifact sizes, initialization behavior, font-byte ownership, shaping-buffer reuse, repeated-shaping memory observations, worker termination behavior, and results for TTF, OTF, WOFF, and WOFF2 inputs.

#### Scenario: Exercise the repeated-shaping path
- **WHEN** the harness completes warm-up and repeatedly shapes a fixed corpus with persistent font objects and a reused buffer
- **THEN** it records timing and memory observations and fails if the WASM heap or retained JavaScript state grows monotonically without a documented bound

#### Scenario: Evaluate each target font format
- **WHEN** equivalent TTF, OTF, WOFF, and WOFF2 fixtures are loaded through the candidate boundary
- **THEN** the report records direct support, required normalization, failure behavior, and the recommended v1 policy for each format

### Requirement: Produce an evidence-backed integration decision
The change MUST produce a committed report that states whether the published HarfBuzzjs wrapper is sufficient, identifies any justified bridge or decoder work, confirms or revises the `FontHandle`, `ShapedRun`, and `GlyphOutline` contracts, and updates the project roadmap and architecture accordingly.

#### Scenario: Complete the validation change
- **WHEN** all automated checks and observations are complete
- **THEN** the report contains reproducible commands, results, limitations, and explicit decisions, and the roadmap and architecture no longer describe questions resolved by the spike as open

#### Scenario: Reject an unsuitable assumption
- **WHEN** a required capability cannot be demonstrated within the spike
- **THEN** the report records the failed assumption and recommends a bounded alternative without silently expanding this change into the full font or layout implementation

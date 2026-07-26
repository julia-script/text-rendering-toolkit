## MODIFIED Requirements

### Requirement: Provide an isolated WebGPU rendering experiment
The project SHALL provide a private strict-TypeScript, ESM-only experiment that validates the Three.js text-rendering seam without exporting a production API or depending on font loading, shaping, text layout, SDF generation, workers, or files under `old/`.

#### Scenario: Run the isolated experiment
- **WHEN** a contributor runs the documented validation command from a clean workspace install
- **THEN** the experiment builds and executes its fixture, browser-rendering, update, and lifecycle checks without requiring any unimplemented package capability

#### Scenario: Preserve public package boundaries
- **WHEN** a consumer imports any `@text-rendering-toolkit/*` package
- **THEN** no experiment module or provisional renderer-seam type is exposed through the package's public exports

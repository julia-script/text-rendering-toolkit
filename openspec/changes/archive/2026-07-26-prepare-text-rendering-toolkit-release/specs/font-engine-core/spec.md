## MODIFIED Requirements

### Requirement: Provide a standalone renderer-neutral font package
The project SHALL expose `@text-rendering-toolkit/font` as a strict-TypeScript, ESM-only package whose public entry point can be consumed without `old/`, `experiments/`, DOM APIs, Three.js, layout, SDF, or renderer dependencies.

#### Scenario: Consume the packed package
- **WHEN** a clean ESM consumer installs the packed font package and imports its public entry point
- **THEN** every JavaScript, type declaration, WASM, and generated runtime asset required to load and use a font is present in the package

#### Scenario: Keep implementation details private
- **WHEN** a consumer inspects the public exports and returned values
- **THEN** no HarfBuzz, Emscripten, WASM pointer, internal wrapper, experiment module, or old Troika type is exposed

### Requirement: Keep color-font support renderer-neutral and attributable
`@text-rendering-toolkit/font` MUST add COLR v0/CPAL support without DOM, canvas, SVG, image-decoder, layout, SDF, Three.js, experiment, or second general-purpose font-parser dependencies and MUST retain the accepted fixture provenance in package evidence.

#### Scenario: Consume color layers from the packed font package
- **WHEN** a clean ESM consumer installs the packed package and loads the accepted COLR v0 fixture through its public entry point
- **THEN** it can shape the accepted emoji corpus, resolve ordered color layers, retrieve their ordinary numeric outlines, and dispose the handle without unpublished paths or missing assets

#### Scenario: Preserve non-color font behavior
- **WHEN** existing TTF and CFF fixtures are loaded and used without requesting color layers
- **THEN** their facts, coverage, shaping, variations, outline caching, errors, package contents, and lifecycle remain unchanged

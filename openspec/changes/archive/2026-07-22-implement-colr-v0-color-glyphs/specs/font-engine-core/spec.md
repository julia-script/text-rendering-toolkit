## ADDED Requirements

### Requirement: Expose lazy COLR v0 color layers
Each live `FontHandle` SHALL expose an optional color-layer lookup for one glyph ID that returns immutable ordered COLR v0 layer glyph identities with either a resolved default-CPAL RGBA color or a current-foreground marker, and SHALL return `null` when the glyph has no supported COLR v0 payload.

#### Scenario: Resolve a layered color glyph
- **WHEN** a caller requests color layers for a glyph with a valid COLR v0 base record and CPAL palette zero
- **THEN** the handle returns the ordered non-empty layer glyph IDs and their exact palette RGBA values without resolving outlines eagerly

#### Scenario: Resolve the current-foreground sentinel
- **WHEN** a COLR v0 layer uses palette index `0xFFFF`
- **THEN** the returned layer identifies current foreground explicitly and does not substitute a font-owned or hard-coded color

#### Scenario: Fall back from an ordinary or unsupported color glyph
- **WHEN** the glyph has no COLR record, the font has no color tables, or its color data uses an unsupported format such as COLR v1
- **THEN** color-layer lookup returns `null` and ordinary coverage, shaping, and outline operations remain available

### Requirement: Validate and cache bounded color-table access
The font package MUST interpret only the SFNT directory, COLR v0 base/layer records, and CPAL palette-zero records needed by the public color-layer operation, MUST reject malformed referenced structures with the existing stable font error boundary, and MUST cache successful and absent glyph lookups per handle.

#### Scenario: Reject malformed color data lazily
- **WHEN** an otherwise shapeable font has truncated, out-of-bounds, inconsistent, or invalid referenced COLR v0 or CPAL data and color-layer lookup reaches it
- **THEN** the operation throws `InvalidFontError` without returning partial layers or invalidating a previously cached valid glyph result

#### Scenario: Reuse a color-layer lookup
- **WHEN** the same glyph's color layers are requested repeatedly from one live handle
- **THEN** the bounded color tables are interpreted once for that identity and the immutable cached result is reused

#### Scenario: Release color state with the handle
- **WHEN** the font handle is disposed
- **THEN** its retained owned bytes and color-layer cache are released, repeated disposal is harmless, and later color-layer lookup throws `DisposedFontHandleError`

### Requirement: Keep color-font support renderer-neutral and attributable
`@webgpu-text/font` MUST add COLR v0/CPAL support without DOM, canvas, SVG, image-decoder, layout, SDF, Three.js, experiment, or second general-purpose font-parser dependencies and MUST retain the accepted fixture provenance in package evidence.

#### Scenario: Consume color layers from the packed font package
- **WHEN** a clean ESM consumer installs the packed package and loads the accepted COLR v0 fixture through its public entry point
- **THEN** it can shape the accepted emoji corpus, resolve ordered color layers, retrieve their ordinary numeric outlines, and dispose the handle without unpublished paths or missing assets

#### Scenario: Preserve non-color font behavior
- **WHEN** existing TTF and CFF fixtures are loaded and used without requesting color layers
- **THEN** their facts, coverage, shaping, variations, outline caching, errors, package contents, and lifecycle remain unchanged

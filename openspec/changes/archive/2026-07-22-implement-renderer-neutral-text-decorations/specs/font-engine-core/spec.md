## ADDED Requirements

### Requirement: Expose normalized text-decoration metrics
Each live `FontHandle` SHALL expose finite renderer-neutral underline position, underline thickness, strikethrough position, and strikethrough thickness in font units as part of its immutable font facts.

#### Scenario: Read declared font metrics
- **WHEN** a supported font contains valid `post` underline metrics and valid OS/2 strikeout metrics
- **THEN** the handle reports their signed positions and positive thicknesses exactly in the font's coordinate system

#### Scenario: Fall back from absent optional metrics
- **WHEN** a supported font omits an optional metric table or declares a non-positive decoration thickness
- **THEN** the handle reports documented deterministic values derived from its existing units-per-em and horizontal extents rather than requiring a renderer fallback

#### Scenario: Keep metric facts stable
- **WHEN** a caller shapes runs, requests outlines or color layers, changes operation-scoped variations, or repeatedly reads font facts
- **THEN** the immutable decoration metrics remain unchanged for the lifetime of the handle

### Requirement: Keep decoration metric parsing bounded
The font package MUST read only the existing SFNT directory and the bounded `post` and OS/2 fields needed for decoration metrics, MUST reuse the package's owned byte copy and validation boundary, and MUST NOT add a general-purpose font parser or new runtime dependency.

#### Scenario: Reject malformed referenced metric data
- **WHEN** a present metric table is truncated or its referenced fields are out of bounds
- **THEN** font loading rejects with `InvalidFontError` without returning partial facts or leaking native objects

#### Scenario: Preserve packed package isolation
- **WHEN** a clean consumer loads representative TTF, CFF/OpenType, variable, and COLR v0 fixtures from the packed font package
- **THEN** it can read decoration metrics without DOM, layout, SDF, Three.js, experiment, or unpublished imports

## ADDED Requirements

### Requirement: Render depth-ink text in two deduplicated passes
`Text` SHALL accept a boolean `depthInk` construction option, fixed at construction and defaulting to `false`. With `depthInk: false` or omitted, rendering behavior is byte-for-byte the existing single transparent pass. With `depthInk: true`, the mesh MUST render its glyph instances in two passes over one shared instanced geometry: a core pass covering fragments whose fill coverage inside the clip rectangle is at least one half, drawn at the flat string opacity, writing the depth buffer under a less-than depth comparison, and discarding non-ink fragments via alpha test so they never write depth; and an edge pass covering all remaining visible fragments — the antialiasing ring, outline, and shadow — blended without depth writes. Core membership MUST be decided on fill coverage alone, never on coverage composed with outline or shadow, so outline ramps and soft shadow interiors retain their gradients. Both passes MUST honor the same appearance state (`opacity`, `clipRect`, outline, shadow) committed by a single `sync()`.

#### Scenario: Overlapping ink blends once at partial opacity
- **WHEN** a `depthInk: true` text with opacity strictly between 0 and 1 renders glyphs whose ink overlaps, such as a connected script or tightly kerned pair
- **THEN** every pixel covered by fully-covered fill ink from more than one glyph reaches exactly the flat string opacity, with no darker seam where the glyphs overlap

#### Scenario: Depth-ink text occludes geometry behind it
- **WHEN** a `depthInk: true` text renders in front of other depth-tested geometry at greater depth
- **THEN** fragments of that geometry behind fully-covered fill ink fail the depth test, while fragments behind the text's non-ink regions render normally

#### Scenario: Antialiasing ring and effects stay soft
- **WHEN** a `depthInk: true` text renders with an outline or a soft shadow
- **THEN** the antialiasing ring, outline ramp, and shadow gradient blend with their partial coverage values rather than being flattened to the core opacity, and are not occluded by the text's own core ink at equal depth beyond the core's exact pixels

#### Scenario: Default construction is unchanged
- **WHEN** a caller constructs `Text` without `depthInk` or with `depthInk: false`
- **THEN** the mesh renders in the existing single transparent non-depth-writing pass with identical output to the prior release

#### Scenario: Reject the unlit-only combination
- **WHEN** a caller constructs `Text` with both `depthInk: true` and `lit: true`
- **THEN** construction throws `InvalidTextInputError` naming the unsupported combination

#### Scenario: One sync commits both passes
- **WHEN** a caller assigns appearance or layout properties on a `depthInk: true` text and awaits one `sync()`
- **THEN** both passes render the committed state consistently — neither pass can present a newer layout, opacity, clip, or effect state than the other

#### Scenario: Disposal releases both passes
- **WHEN** a caller disposes a `depthInk: true` text
- **THEN** the geometry and the materials of both passes are released exactly once, and shared `TextResources` remain usable by other borrowers

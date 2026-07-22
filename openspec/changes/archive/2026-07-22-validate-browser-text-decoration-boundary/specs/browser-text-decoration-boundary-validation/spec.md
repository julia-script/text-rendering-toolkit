## ADDED Requirements

### Requirement: Isolate decoration-boundary validation
The project SHALL validate browser-like text decoration and glyph paint in a private strict-TypeScript, ESM-only experiment that exercises public package boundaries without adding production decoration APIs or importing private validation code into published packages.

#### Scenario: Inspect the validation workspace
- **WHEN** the decoration experiment, workspace manifests, and production package dependency graph are inspected
- **THEN** the experiment is private, production packages do not depend on it, and no public package claims decoration, outline, or drop-shadow support from the spike alone

#### Scenario: Execute in the existing toolchain
- **WHEN** deterministic validation and browser evidence run
- **THEN** they use the repository's existing package manager, TypeScript, Vitest, Three.js WebGPU, and documentation conventions without introducing a new public package or runtime dependency

### Requirement: Define representative editor-decoration evidence
The validation corpus MUST cover solid, dotted, and wavy underline, solid strikethrough, independent decoration color, current foreground, source-range styling, wrapping, bidirectional placement, mixed fonts and sizes, font metrics, pattern phase, skip-ink candidates, clipping, and color glyph coexistence.

#### Scenario: Render an independent underline color
- **WHEN** a source range uses a glyph fill color and a different explicit underline color
- **THEN** observations identify distinct visible colors and changing either color does not require reshaping, relayout, or a new glyph SDF resource

#### Scenario: Compare underline patterns
- **WHEN** equal decorated ranges use solid, dotted, and wavy underline styles
- **THEN** the fixtures record deterministic position, thickness, pattern dimensions, phase, range clipping, and line-fragment behavior for each style

#### Scenario: Exercise editor-oriented ranges
- **WHEN** decoration ranges start or end within a line, meet adjacent ranges, include spaces, cross a soft or hard break, or intersect differently styled text
- **THEN** visual segments preserve half-open UTF-16 ownership without decorating unrelated source content or changing the supplied layout

#### Scenario: Exercise multilingual placement
- **WHEN** ranges intersect Latin descenders, combining marks, Arabic, mixed bidi text, mixed fonts, mixed sizes, and COLR v0 emoji
- **THEN** the evidence records visual fragment order, baseline-relative placement, metric selection, and any unsupported compatibility behavior explicitly

### Requirement: Compare renderer-neutral decoration contracts
The experiment SHALL compare the minimum renderer-neutral inputs, font metrics, and outputs required to convert logical decoration ranges into visual line segments without making a renderer perform shaping, line breaking, bidi policy, font-table parsing, or source-range inference.

#### Scenario: Fragment a wrapped range
- **WHEN** one logical decoration range crosses one or more selected line boundaries
- **THEN** the candidate produces bounded visual segments for the intersecting line fragments while preserving the original layout's glyphs, lines, carets, selections, and source ranges

#### Scenario: Fragment a bidi range
- **WHEN** one logical range maps to discontiguous visual intervals because of bidirectional placement
- **THEN** the candidate represents each visual interval explicitly rather than joining unrelated intervening glyphs

#### Scenario: Resolve automatic metrics
- **WHEN** underline or strikethrough position and thickness are automatic across mixed fonts or sizes
- **THEN** the observations compare available layout data, caller-owned font metrics, and explicit overrides and identify the smallest boundary that produces deterministic placement

#### Scenario: Keep preparation reusable
- **WHEN** only decoration style or color changes for an existing prepared and laid-out string
- **THEN** the selected contract permits reuse of shaping and layout unless the evidence demonstrates that a specific geometry-affecting value requires recomputation

### Requirement: Validate analytic line-decoration representation
The experiment MUST prove or reject a renderer-neutral analytic segment representation for solid, dotted, and wavy decorations, including deterministic phase, color, thickness, offset, fragment clipping, and a declared skip-ink policy.

#### Scenario: Consume a segment without text logic
- **WHEN** a minimal non-Three consumer receives candidate decoration segments
- **THEN** it can reproduce their geometry and appearance without access to raw shaping runs, font selection, line breaking, bidi resolution, glyph atlases, or Three.js objects

#### Scenario: Preserve dotted and wavy continuity
- **WHEN** dotted or wavy decoration spans are divided by style, bidi, clipping, or line boundaries
- **THEN** the recorded phase rule produces deterministic endpoints and avoids renderer-dependent pattern drift

#### Scenario: Compare skip-ink policies
- **WHEN** an underline intersects glyph descenders or marks
- **THEN** bounds-only, outline-aware, or explicit no-skip candidates are measured for fidelity, lazy-outline cost, and backend-neutral representation and one first-production policy is selected

### Requirement: Measure shared-SDF outline and shadow paint
The Three validation path SHALL measure whether one existing glyph SDF and stable shared-resource slot can produce fill, stroke or outline, and one offset or softened drop shadow while keeping appearance color and controls outside resource identity.

#### Scenario: Reuse one glyph resource
- **WHEN** the same glyph is rendered with different fill, outline, or shadow colors and supported paint controls
- **THEN** observations show whether its outline extraction, generated SDF pixels, atlas slot, and shared-resource identity remain reused

#### Scenario: Measure outline quality limits
- **WHEN** representative glyphs render at multiple text and SDF sizes with increasing outline width
- **THEN** the evidence records antialiasing, distance precision, interior readability, padded bounds, clipping, and the maximum accepted range or explicit failure policy

#### Scenario: Measure shadow quality limits
- **WHEN** representative glyphs render with offset and increasing softness
- **THEN** the evidence records coverage, transparency, expanded bounds, clipping, distance precision, and the maximum accepted range or explicit failure policy

#### Scenario: Preserve atomic updates
- **WHEN** appearance changes succeed or an unsupported paint request fails during synchronization
- **THEN** the candidate commits complete geometry, material, and bounds together or retains the last valid frame without corrupting shared resources

### Requirement: Prove composition through actual WebGPU
The experiment SHALL render representative decorations and glyph paint through the pinned Three.js `WebGPURenderer` and record semantic observations for unlit text and, where applicable, the existing planar-lit path.

#### Scenario: Observe decorated text
- **WHEN** representative solid, dotted, and wavy underlines with independent colors render in an actual WebGPU frame
- **THEN** semantic observations confirm expected color separation, pattern presence, placement, transparent surroundings, line fragmentation, and clipping rather than relying only on screenshot approval

#### Scenario: Observe outline and shadow
- **WHEN** accepted outline and shadow controls render with ordinary glyphs and representative COLR v0 content
- **THEN** observations identify supported composition semantics, visible extents, resource reuse, and any deliberately unsupported color-layer case

#### Scenario: Dispose validation resources
- **WHEN** decorated text, shared resources, renderer state, and the validation harness are disposed repeatedly
- **THEN** owned geometry, materials, textures, and temporary browser or GPU resources are released without disposing caller-owned fonts

### Requirement: Record a bounded production decision
The change MUST produce machine-readable observations and a human-readable decision report that selects the renderer-neutral decoration boundary, underline pattern and color semantics, metric and skip-ink policy, shared-SDF paint limits, COLR behavior, package ownership, and scoped production follow-ups.

#### Scenario: Inspect the decision report
- **WHEN** maintainers review the completed validation record
- **THEN** it distinguishes measured facts from recommendations, includes narrow TypeScript contract sketches, records rejected alternatives and unsupported cases, and does not present private experiment types as public API

#### Scenario: Scope production follow-ups
- **WHEN** the evidence supports production work
- **THEN** the report defines independently implementable follow-ups for renderer-neutral line decoration and Three glyph paint, with acceptance criteria for solid, dotted, and wavy underline, independent color, and the validated outline and shadow limits

#### Scenario: Reconcile project direction
- **WHEN** the report is complete
- **THEN** the roadmap and architecture are updated only with evidence-backed decisions and continue to defer arbitrary effects, interaction work, and public release unless separately authorized

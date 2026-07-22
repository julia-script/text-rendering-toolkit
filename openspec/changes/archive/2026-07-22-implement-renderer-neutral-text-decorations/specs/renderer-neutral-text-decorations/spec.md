## ADDED Requirements

### Requirement: Accept independent styled decoration spans
The layout package SHALL accept immutable half-open UTF-16 decoration spans that independently declare underline or strikethrough, a supported line style, explicit RGBA or current-foreground color, automatic or numeric thickness and offset, and no-skip or automatic skip-ink behavior.

#### Scenario: Decorate a partial source range
- **WHEN** a valid span starts or ends within a laid-out line
- **THEN** only the corresponding visual intervals are decorated and unrelated source content remains unchanged

#### Scenario: Keep decoration color independent
- **WHEN** a span uses explicit RGBA different from glyph fill or uses current foreground
- **THEN** every produced segment retains that paint value without adding it to shaping style or resolving current foreground inside layout

#### Scenario: Meet adjacent styles
- **WHEN** adjacent half-open spans use different styles, colors, metrics, or skip-ink values
- **THEN** each owns exactly its source range and the result retains an explicit boundary between their segments

### Requirement: Produce immutable analytic visual segments
Decoration derivation SHALL return immutable renderer-neutral segments containing source and line identity, visual start and end, baseline-relative position, positive thickness, pattern amplitude, wavelength and phase, unresolved paint, skip-ink policy, and aggregate decoration bounds without returning Three.js objects or renderer tessellation.

#### Scenario: Fragment wrapping and hard breaks
- **WHEN** one logical span crosses soft-wrapped, hard-broken, trailing-space, or empty-line ranges
- **THEN** derivation emits only the non-empty bounded visual fragments on each affected line and does not bridge separate lines

#### Scenario: Fragment bidirectional placement
- **WHEN** one logical span maps to discontiguous visual intervals after bidi placement
- **THEN** derivation emits those intervals separately and does not cover unrelated intervening glyphs

#### Scenario: Keep automatic metrics stable across fallback fonts
- **WHEN** one decoration span crosses fallback runs with different retained automatic decoration metrics, including a color-emoji run
- **THEN** derivation resolves the span from its first effective retained metric context and does not shift or split only because the fallback font changed

#### Scenario: Resolve adjacent spans independently
- **WHEN** adjacent decoration spans begin in source ranges with different retained metrics
- **THEN** each span resolves its own automatic metric context while retaining their explicit style boundary

#### Scenario: Consume without Three
- **WHEN** a Canvas, SVG, native, or typed-array consumer receives the public segments
- **THEN** it has enough numeric geometry and paint information to reproduce the decoration without raw text logic, font access, glyph outlines, SDFs, atlases, or Three.js

### Requirement: Support the first browser-like style set
The first production contract MUST support solid, dotted, and wavy underline plus solid strikethrough and MUST reject unsupported kind/style combinations explicitly.

#### Scenario: Resolve a solid line
- **WHEN** a solid underline or strikethrough is derived
- **THEN** its segment has zero amplitude and wavelength and its visual band is completely described by start, end, position, and thickness

#### Scenario: Resolve a dotted underline
- **WHEN** a dotted underline is derived
- **THEN** its segment declares deterministic dot diameter, spacing, and phase derived from its resolved thickness

#### Scenario: Resolve a wavy underline
- **WHEN** a wavy underline is derived
- **THEN** its segment declares deterministic amplitude, wavelength, thickness, and phase derived from its resolved thickness

### Requirement: Resolve automatic and explicit metrics deterministically
Automatic decoration placement SHALL use the first effective retained scaled metric context for the complete decoration span, while finite numeric thickness and offset SHALL override automatic values without consulting fonts or outlines.

#### Scenario: Use automatic underline metrics
- **WHEN** an underline requests automatic thickness and offset
- **THEN** its center position and positive thickness come from the effective run's retained underline metrics relative to the line baseline

#### Scenario: Use automatic strikethrough metrics
- **WHEN** a strikethrough requests automatic thickness and offset
- **THEN** its center position and positive thickness come from the effective run's retained strikethrough metrics relative to the line baseline

#### Scenario: Apply numeric overrides
- **WHEN** a span supplies finite numeric thickness or offset
- **THEN** the supplied value replaces only that automatic metric and is interpreted directly in layout units

### Requirement: Preserve deterministic pattern phase and clipping
Each visual line fragment SHALL start with phase zero, and horizontal clipping or skip-ink cuts SHALL advance retained piece phase by the removed distance so dotted and wavy patterns do not restart inside the fragment.

#### Scenario: Start a new visual fragment
- **WHEN** wrapping, a hard break, bidi fragmentation, or an adjacent style boundary creates a new visual fragment
- **THEN** its pattern phase starts at zero independently of prior fragments

#### Scenario: Clip a patterned fragment
- **WHEN** a clip bound removes the beginning or end of a dotted or wavy fragment
- **THEN** the visible piece stays within the clip and retains the phase it would have had before clipping

### Requirement: Offer bounded skip ink without eager outlines
Decoration derivation SHALL default to no skip ink and SHALL support an explicit automatic mode that subtracts intersecting positioned-glyph bounds while preserving phase, without resolving glyph outlines.

#### Scenario: Keep the default continuous
- **WHEN** skip ink is omitted or set to none
- **THEN** the decoration remains continuous through glyph bounds and no glyph outline work occurs

#### Scenario: Cut around available ink bounds
- **WHEN** automatic skip ink intersects a glyph's finite positioned bounds on the same line
- **THEN** derivation emits the remaining non-empty pieces with deterministic clearance and preserved pattern phase

#### Scenario: Ignore unavailable ink bounds
- **WHEN** a glyph has no positioned bounds
- **THEN** automatic skip ink leaves the decoration unchanged for that glyph and does not request an outline

#### Scenario: Permit renderer-owned ink refinement
- **WHEN** an analytic consumer already owns glyph outlines, masks, or SDF coverage
- **THEN** the retained automatic skip-ink policy allows that renderer to suppress exact intersecting ink without moving outline access into layout

### Requirement: Conform to the validated multilingual corpus
The production implementation MUST satisfy deterministic decoration fixtures covering Latin descenders, combining marks, Arabic, mixed bidi, mixed fonts and sizes, spaces, wrapping, numeric overrides, clipping, and COLR v0 coexistence through public package APIs.

#### Scenario: Preserve text identities
- **WHEN** the accepted corpus derives one or more decoration variants from a layout
- **THEN** the original glyph, line, caret, selection, preparation, and color-glyph identities remain unchanged

#### Scenario: Validate packed and browser-neutral consumption
- **WHEN** clean ESM and browser consumers import the packed layout package
- **THEN** decoration derivation works without experiment code, `old/`, DOM requirements, Three.js, SDF, or a GPU

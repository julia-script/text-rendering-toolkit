# Color Glyph Boundary Validation

## Purpose

Define the reproducible evidence and decision boundary for selecting the first production color-glyph format without prematurely changing public package contracts.

## Requirements

### Requirement: Keep color-glyph investigation private and reproducible
The validation SHALL run as a strict-TypeScript, ESM-only private experiment that consumes production packages only through public entry points, does not become a dependency of any public package, and records deterministic reproduction commands and environment facts.

#### Scenario: Run the isolated experiment
- **WHEN** a contributor installs the workspace and runs the documented color-glyph validation commands
- **THEN** the experiment executes without importing `old/`, private production modules, WebGL, CommonJS, system fonts, or unpublished package paths

#### Scenario: Protect production contracts
- **WHEN** the spike completes with a preferred color format
- **THEN** no public font, layout, SDF, or Three declaration has changed and production support remains a separately reviewable follow-up

### Requirement: Preserve attributable representative font evidence
The validation MUST exercise representative COLR v0/CPAL, COLR v1/CPAL, embedded color-bitmap, and SVG-table evidence using fixtures or reproducible acquisitions with source revision, license, derivation, integrity, table inventory, and corpus coverage recorded.

#### Scenario: Audit a committed fixture
- **WHEN** a color font or subset is stored in the repository
- **THEN** its metadata identifies an allowing license, original source and revision, transformation command, SHA-256 digest, contained color tables, and accepted glyph sequences

#### Scenario: Acquire an uncommitted fixture reproducibly
- **WHEN** a representative font cannot reasonably or lawfully be committed
- **THEN** the experiment documents a pinned acquisition location, expected digest, license, local cache location, and explicit failure when the bytes do not match

#### Scenario: Reject incomplete evidence
- **WHEN** a candidate lacks attributable bytes, a verified color-table inventory, or at least one shaped glyph in the accepted corpus
- **THEN** it is marked unvalidated and cannot be selected as the first production format

### Requirement: Characterize existing font-engine color access before adding a parser
The validation MUST record the pinned wrapper and embedded HarfBuzz revisions, relevant WASM exports and build flags, raw color-table availability, upstream color operations, and the smallest demonstrated access path for every candidate family.

#### Scenario: Inspect the current bundled runtime
- **WHEN** the production HarfBuzz WASM is examined
- **THEN** the observation records which raw-table, outline, palette, layer, paint, PNG, and SVG operations are present or absent rather than inferring capability from upstream C APIs

#### Scenario: Evaluate bounded access alternatives
- **WHEN** the bundled runtime does not export a required upstream operation
- **THEN** the spike compares only an existing raw-table path, a minimal reproducible HarfBuzz export bridge, and any demonstrably necessary focused decoder by correctness, maintenance, binary size, ESM/browser behavior, and lifecycle

#### Scenario: Avoid a general parser by default
- **WHEN** one bounded engine or table-access path can resolve the accepted candidate corpus
- **THEN** the recommendation does not add a second general-purpose production font parser or expose arbitrary table inspection

### Requirement: Separate presentation, shaping, and paint observations
The validation SHALL exercise default text and emoji presentation, U+FE0E and U+FE0F, modifiers, regional indicators, ZWJ sequences, ordinary outline fallback, missing glyphs, explicit font ordering, and styled font transitions while recording font selection, HarfBuzz glyph output, and color-payload resolution as separate results.

#### Scenario: Shape representative emoji sequences
- **WHEN** accepted single-code-point, variation-selector, modifier, flag, and ZWJ cases are prepared and laid out with pinned caller-owned fonts
- **THEN** valid UTF-16 source ranges, selected font keys, glyph IDs, advances, positions, and payload availability are recorded without splitting the sequence during fallback

#### Scenario: Cross a style boundary
- **WHEN** adjacent text and emoji use different style ranges, sizes, foreground colors, or ordered font lists
- **THEN** layout remains deterministic and the observation identifies whether paint choice depends on style, palette, foreground color, or only the final font/glyph identity

#### Scenario: Expose monochrome capture
- **WHEN** an earlier font in the caller's order supports an emoji code point only with an ordinary outline while a later font offers color data
- **THEN** the report records the actual selection and explicitly decides whether caller ordering is sufficient or a future presentation policy is required

### Requirement: Validate the renderer-neutral positioned-glyph boundary
The validation MUST attempt color resolution lazily from final positioned font/glyph/variation identities and MUST preserve the existing `PreparedText` and `LayoutResult` shapes unless a concrete accepted case cannot be represented correctly.

#### Scenario: Resolve color after layout
- **WHEN** an accepted color glyph is present in a completed `LayoutResult`
- **THEN** the experimental renderer can request its payload using caller-owned font identity, glyph ID, canonical variations, and only format-specific rendering inputs without embedding paint data in layout

#### Scenario: Reuse layout in a non-color consumer
- **WHEN** the same completed layout is consumed by measurement, selection, or a renderer that supports only ordinary outlines
- **THEN** no color tables, decoded pixels, paint graphs, textures, or renderer objects are required to inspect the layout or use its interaction geometry

#### Scenario: Record a required layout change honestly
- **WHEN** a representative accepted case cannot choose or place the correct color glyph from existing positioned identity and explicit caller font order
- **THEN** the report provides the smallest reproducible counterexample and scopes a later layout requirement instead of mutating layout during the spike

### Requirement: Select candidates from recorded comparative evidence
The validation MUST compare COLR v0, COLR v1, embedded bitmap, and SVG candidates by accepted emoji coverage, visual scalability, palette and foreground behavior, variation behavior, engine access, bundle and cache cost, renderer complexity, browser ESM viability, lifecycle, and fixture provenance.

#### Scenario: Score every candidate
- **WHEN** candidate probes complete
- **THEN** a machine-readable matrix records each criterion, observation, limitation, and evidence reference without treating implementation simplicity as proof of useful emoji coverage

#### Scenario: Bound incomplete candidates
- **WHEN** a candidate requires unsupported paint nodes, unsafe SVG behavior, unavailable bitmap decoding, or disproportionate engine changes
- **THEN** it is explicitly rejected or assigned a measurable prerequisite rather than silently represented as supported

#### Scenario: Resolve a close comparison
- **WHEN** two candidates remain close after static inspection
- **THEN** at most one additional minimal renderer adapter is built to answer the specific unresolved trade-off before selection

### Requirement: Prove the selected payload beside monochrome SDF text in actual WebGPU
The highest-scoring viable candidate SHALL receive one private lazy Three.js WebGPU resource path that coexists with the production monochrome SDF path and demonstrates correct semantic rendering, cache identity, atomic failure behavior, and deterministic disposal.

#### Scenario: Render a mixed color and monochrome line
- **WHEN** the accepted public layout containing ordinary text and representative color emoji is rendered with the pinned Three `WebGPURenderer` on an actual WebGPU adapter
- **THEN** semantic pixel checks observe expected intrinsic colors, transparent exterior, bounded opacity, correct relative placement and scale, and unchanged monochrome SDF rendering

#### Scenario: Reuse a color resource
- **WHEN** repeated glyphs or multiple experimental text borrowers use the same font object, glyph, variations, palette or foreground inputs, and relevant size settings
- **THEN** the second use reuses one resolved color resource while distinct pixel-affecting inputs receive distinct identities

#### Scenario: Fail without corrupting accepted state
- **WHEN** color resolution or decoding rejects an unsupported or malformed payload after a prior successful frame
- **THEN** no partial resource or geometry state replaces the last accepted render and a later valid case can render

#### Scenario: Dispose renderer-owned data only
- **WHEN** the experimental text and shared resources are disposed
- **THEN** their color textures, decoded pixels, and caches are released idempotently without disposing caller-owned fonts, renderer, canvas, or lower-package state

### Requirement: Produce a decisive production handoff
The validation MUST publish machine-readable observations and one human-readable report that concludes with a go, conditional-go, or no-go recommendation and updates project planning only from those results.

#### Scenario: Recommend production support
- **WHEN** one candidate satisfies the accepted corpus and maintenance constraints
- **THEN** the report names that first format, demonstrated access path, private proof result, public contract sketch, package ownership, fallback behavior, unsupported cases, production acceptance tests, and follow-up OpenSpec scope

#### Scenario: Require a prerequisite
- **WHEN** a viable candidate depends on one bounded missing export, decoder, or renderer capability
- **THEN** the report names a single measurable prerequisite and does not claim implementation readiness until it passes

#### Scenario: Reject current production support
- **WHEN** no candidate provides a maintainable useful increment
- **THEN** the report records a no-go decision, preserves the evidence, and states what changed evidence would justify reconsideration

#### Scenario: Reconcile architecture and roadmap
- **WHEN** the decision report is complete
- **THEN** `ARCHITECTURE.md` and `ROADMAP.md` distinguish validated facts, the selected or rejected production direction, deliberately unsupported formats, and remaining work without marking color glyphs shipped

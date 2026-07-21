## ADDED Requirements

### Requirement: Define a renderer-neutral draft layout boundary
The validation SHALL define draft resolved-run input and layout-result contracts using serializable JavaScript data and typed numeric arrays, with UTF-16 source ranges, stable font and glyph references, positioned glyphs, line records, bounds, and caret stops.

#### Scenario: Inspect a normalized layout result
- **WHEN** a contributor inspects a representative accepted fixture
- **THEN** its result identifies every positioned glyph by font key, glyph ID, logical UTF-16 source range, line, origin, advances, offsets, and finite bounds

#### Scenario: Keep higher layers outside the boundary
- **WHEN** fixture contracts and results are inspected
- **THEN** they contain no font handles, outlines, SVG paths, SDF pixels, atlas slots, worker state, browser objects, Three.js objects, or GPU resources

#### Scenario: Preserve lazy outline ownership
- **WHEN** a future renderer needs an outline for a positioned glyph reference
- **THEN** the draft result contains sufficient stable font, glyph, and variation identity to request it later without embedding the outline in every layout result

### Requirement: Isolate policy fixtures from shaping engines
The primary fixture corpus MUST supply deterministic resolved shaped runs and font metrics directly so that layout-policy expectations do not depend on Troika shaping, HarfBuzz revisions, or font-binary revisions.

#### Scenario: Execute a synthetic policy fixture
- **WHEN** a fixture for wrapping, placement, carets, or bounds is loaded
- **THEN** all shaped glyph IDs, clusters, advances, offsets, bounds, directions, scripts, languages, font keys, and metrics required by that case are present in the fixture

#### Scenario: Use controlled numeric evidence
- **WHEN** expected numeric output is serialized
- **THEN** non-finite values are rejected, negative zero is canonicalized to zero, and documented precision rules produce stable JSON

### Requirement: Preserve line-construction policy
The fixture corpus SHALL define accepted behavior for text normalization, explicit line breaks, whitespace, width constraints, wrapping, indentation, letter spacing, and line metrics without requiring renderer state.

#### Scenario: Normalize line endings and preserve empty lines
- **WHEN** cases contain CRLF, CR, LF, consecutive line breaks, or a trailing line break
- **THEN** expected line records and logical source ranges state the accepted normalization and empty-line behavior

#### Scenario: Exercise wrapping modes
- **WHEN** cases combine finite width with normal wrapping, no-wrap, break-word overflow, trailing whitespace, or an unbreakable run
- **THEN** expected lines identify hard versus soft breaks, logical ranges, widths, and positioned glyph membership

#### Scenario: Combine spacing and metrics
- **WHEN** cases use letter spacing, indentation, explicit or normal line height, or fonts with different ascender and descender metrics
- **THEN** expected baselines, line extents, glyph origins, and block bounds define the accepted order of operations

### Requirement: Preserve visual placement policy
The fixture corpus SHALL define accepted horizontal alignment, justification, anchoring, and bidi visual placement while retaining logical UTF-16 source identity.

#### Scenario: Apply alignment and justification
- **WHEN** equivalent lines use left, center, right, or justified alignment
- **THEN** expected glyph origins and line extents identify the alignment translation and any distributable whitespace expansion

#### Scenario: Apply anchors consistently
- **WHEN** a case uses numeric, keyword, or percentage horizontal or vertical anchors
- **THEN** glyphs, lines, carets, selections, block bounds, and visible bounds receive a consistent translation

#### Scenario: Place mixed-direction text
- **WHEN** explicit shaped runs contain LTR and RTL segments spanning one or more lines
- **THEN** expected glyph order and positions follow the accepted visual ordering while every glyph and caret retains a valid logical source range

### Requirement: Preserve style and font-run boundaries
The fixture corpus SHALL represent style, size, variation, language, and fallback font boundaries independently from glyph placement and SHALL define how those boundaries affect metrics and stable font references.

#### Scenario: Cross a style or size boundary
- **WHEN** a UTF-16 text range changes style key, effective font size, language, or variation coordinates
- **THEN** the fixture splits resolved runs at valid boundaries and expected line metrics and glyph references reflect the applicable run values

#### Scenario: Cross a fallback font boundary
- **WHEN** adjacent grapheme-safe ranges resolve to different font keys
- **THEN** expected positioned glyphs preserve logical source coverage, use the correct stable font key, and compute line metrics from all participating runs

### Requirement: Preserve interaction geometry
The fixture corpus SHALL define caret stops and pure selection-rectangle results for logical UTF-16 boundaries across lines, bidi runs, ligatures, combining sequences, and supplementary-plane text.

#### Scenario: Represent valid caret stops
- **WHEN** a case contains ordinary characters, a ligature, a combining sequence, reordered text, or a supplementary-plane character
- **THEN** expected caret stops cover the accepted editable boundaries without splitting a surrogate pair and include line and directional edge geometry

#### Scenario: Derive selection rectangles
- **WHEN** a fixture queries forward, reversed, empty, clipped, multiline, or mixed-bidi selections
- **THEN** the pure selection result contains the accepted finite non-overlapping rectangles in deterministic visual order

### Requirement: Define bounds independently of renderer chunks
The fixture corpus SHALL define block, line, and visible glyph bounds from layout data without atlas dimensions, SDF padding, geometry chunks, or GPU culling structures.

#### Scenario: Compare block and visible bounds
- **WHEN** a case contains whitespace, overhanging glyph bounds, empty lines, or mixed font sizes
- **THEN** expected block bounds reflect layout extents while visible bounds enclose only visible glyph geometry according to the documented empty-result policy

#### Scenario: Vary fixture grouping
- **WHEN** identical positioned glyphs are grouped differently by a test harness
- **THEN** the accepted overall bounds remain unchanged because chunk boundaries are not part of the layout contract

### Requirement: Prove compatibility with the public font package
The validation SHALL include a bounded pinned-font matrix that shapes explicit resolved runs only through the public `@webgpu-text/font` entry point and translates the returned data into the draft resolved-run contract.

#### Scenario: Translate representative real runs
- **WHEN** pinned Latin, Arabic, Devanagari, Khmer, combining-mark, supplementary-plane, and explicit mixed-direction runs are shaped
- **THEN** glyph IDs, UTF-16 clusters, advances, offsets, flags, variations, and font identity populate the draft contract without importing font internals

#### Scenario: Keep policy expectations stable
- **WHEN** a real-font observation changes because an engine or fixture revision is intentionally updated
- **THEN** synthetic layout-policy expectations remain unchanged unless the layout contract itself is deliberately revised

### Requirement: Classify and attribute reference behavior
Every committed legacy observation MUST record its source revision or integrity identifier and MUST be classified as preserved, intentionally changed, or deferred with a reviewable rationale.

#### Scenario: Audit a preserved behavior
- **WHEN** a fixture intentionally carries forward Troika behavior
- **THEN** the validation report links the fixture to the relevant reference area and explains why the behavior is renderer-neutral and retained

#### Scenario: Audit an intentional difference
- **WHEN** HarfBuzz semantics, safer Unicode boundaries, or the new package architecture differ from Troika output
- **THEN** the validation report records the difference and rationale without treating the legacy output as a failing golden snapshot

#### Scenario: Reject an unclassified observation
- **WHEN** a committed reference observation has no classification or rationale
- **THEN** validation fails before the fixture can be accepted

### Requirement: Keep validation independent and implementation-free
The committed validation suite MUST run from a clean workspace without the ignored `old/` checkout and MUST NOT expose or implement a production layout function as part of this change.

#### Scenario: Run normal workspace checks
- **WHEN** a contributor runs formatting, type checking, tests, and builds without `old/`
- **THEN** fixture schema checks, contract invariants, real-font integration observations, and classification completeness pass using only committed files and public package exports

#### Scenario: Inspect the layout package after validation
- **WHEN** the change is complete
- **THEN** the package contains draft contracts and validation support but no production font fetching, itemization, fallback, line-layout engine, worker adapter, SDF generation, atlas management, or renderer implementation

# Font Engine Core

## Purpose

Define the standalone renderer-neutral font package contract for loading supported font bytes, querying font facts and coverage, shaping explicit text runs, retrieving lazy numeric outlines, and disposing native resources deterministically.

## Requirements

### Requirement: Provide a standalone renderer-neutral font package
The project SHALL expose `@text-rendering-toolkit/font` as a strict-TypeScript, ESM-only package whose public entry point can be consumed without `old/`, `experiments/`, DOM APIs, Three.js, layout, SDF, or renderer dependencies.

#### Scenario: Consume the packed package
- **WHEN** a clean ESM consumer installs the packed font package and imports its public entry point
- **THEN** every JavaScript, type declaration, WASM, and generated runtime asset required to load and use a font is present in the package

#### Scenario: Keep implementation details private
- **WHEN** a consumer inspects the public exports and returned values
- **THEN** no HarfBuzz, Emscripten, WASM pointer, internal wrapper, experiment module, or old Troika type is exposed

### Requirement: Load owned font handles from byte sources
The package SHALL asynchronously load an `ArrayBuffer` or `Uint8Array` into an opaque `FontHandle` that owns the native font objects and an exact copy of the supplied byte range. Loading MUST report a byte source it cannot copy — including a detached `ArrayBuffer` or a view onto one — as a public `InvalidFontError` rather than allowing the underlying allocation failure to escape.

#### Scenario: Load an ArrayBuffer
- **WHEN** a consumer passes valid supported font bytes in an `ArrayBuffer`
- **THEN** loading resolves to a usable handle with normalized facts

#### Scenario: Respect a Uint8Array view
- **WHEN** a consumer passes a `Uint8Array` whose view covers only part of its backing buffer
- **THEN** loading uses exactly the view's `byteOffset` and `byteLength` and ignores bytes outside that range

#### Scenario: Decouple caller byte lifetime
- **WHEN** the caller mutates or releases its source bytes after loading resolves
- **THEN** subsequent facts, shaping, coverage, and outline results from the handle remain unchanged

#### Scenario: Reject a detached byte source
- **WHEN** a consumer passes an `ArrayBuffer` that has already been detached, such as one transferred to a worker or through `structuredClone`, or a `Uint8Array` view onto such a buffer
- **THEN** loading rejects with `InvalidFontError` rather than surfacing the allocation's own `TypeError`

### Requirement: Enforce the v1 font-format policy
The package MUST accept usable TrueType-flavored TTF and CFF-flavored OpenType inputs and MUST reject unsupported or invalid containers before presenting a usable handle.

#### Scenario: Load supported outline formats
- **WHEN** representative TTF and CFF/OpenType fixtures are loaded
- **THEN** each produces non-empty coverage, valid metrics, shaping output, and numeric outlines

#### Scenario: Reject WOFF and WOFF2 explicitly
- **WHEN** input begins with a WOFF or WOFF2 signature
- **THEN** loading rejects with `UnsupportedFontFormatError` identifying the unsupported container

#### Scenario: Reject an unusable font
- **WHEN** input is empty, truncated, a collection, or does not produce a usable SFNT face
- **THEN** loading rejects with `InvalidFontError` and releases any native objects created during the failed attempt

### Requirement: Expose normalized facts and Unicode coverage
Each live `FontHandle` SHALL expose renderer-neutral units-per-em, horizontal extents, coverage count, and variation-axis facts and SHALL provide code-point coverage checks without exposing mutable native state.

#### Scenario: Inspect normalized facts
- **WHEN** a consumer loads a representative variable font
- **THEN** the handle reports finite units-per-em, ascender, descender, line gap, coverage count, and axis tag/minimum/default/maximum values matching the accepted fixture facts

#### Scenario: Check coverage by Unicode code point
- **WHEN** a consumer queries supported and unsupported valid Unicode code points
- **THEN** the handle returns the corresponding nominal-glyph coverage result

### Requirement: Shape explicit text runs
Each live `FontHandle` SHALL shape explicit text, direction, script, and language inputs and return a serializable `ShapedRun` containing glyph IDs, finite advances and offsets, flags, and source cluster ranges.

#### Scenario: Shape representative scripts
- **WHEN** the accepted Latin, Arabic, Devanagari, and Khmer run cases are shaped with their explicit properties and features
- **THEN** the result matches the pinned engine-and-fixture observations for glyph IDs, advances, offsets, flags, and cluster ranges

#### Scenario: Preserve UTF-16 source ranges
- **WHEN** a run contains ligatures, combining sequences, supplementary-plane characters, reordering, or right-to-left output
- **THEN** every glyph's cluster start and end are valid UTF-16 boundaries in the original string and do not split a surrogate pair

#### Scenario: Keep paragraph policy outside the package
- **WHEN** a consumer has mixed-direction paragraph text
- **THEN** the consumer supplies separately segmented directional runs and the font package does not perform paragraph bidi, line layout, or caret policy

#### Scenario: Reject invalid shaping input
- **WHEN** required run properties, feature values, variation values, or numeric inputs are invalid
- **THEN** shaping throws a stable typed input error before invoking native shaping

### Requirement: Apply variations without hidden state
The package MUST accept explicit variation coordinates on shaping and outline operations, normalize them deterministically, and prevent one operation's coordinates from implicitly changing another operation's result.

#### Scenario: Alternate variation settings
- **WHEN** a consumer alternates shape and outline requests for two coordinate sets on one handle
- **THEN** each result matches its requested coordinates regardless of call order

#### Scenario: Report normalized shaping coordinates
- **WHEN** a shaped run uses variation coordinates
- **THEN** the returned run records the normalized coordinates needed to request matching outlines later

### Requirement: Return lazy direct numeric outlines
Each live `FontHandle` SHALL retrieve a glyph outline on demand as documented numeric opcodes, sequential typed coordinates, and finite axis-aligned bounds using direct HarfBuzz drawing callbacks without constructing or parsing SVG path strings.

#### Scenario: Retrieve TrueType and CFF outlines
- **WHEN** a consumer requests representative non-empty glyphs from TTF and CFF/OpenType fixtures
- **THEN** each outline contains valid move, line, quadratic, cubic, or close opcodes as applicable, coordinate counts matching those opcodes, and bounds enclosing the emitted outline

#### Scenario: Retrieve an empty glyph
- **WHEN** a consumer requests a valid glyph with no contours such as a space glyph
- **THEN** the result contains empty command and coordinate arrays with deterministic zero bounds

#### Scenario: Cache by glyph and variations
- **WHEN** the same glyph and canonical variation coordinates are requested repeatedly from one handle
- **THEN** the outline is drawn once and served from the handle-local cache, while a different coordinate set uses a distinct cache entry

### Requirement: Provide deterministic handle disposal
Each `FontHandle` MUST provide idempotent deterministic disposal that releases its buffer, font, face, blob, and outline cache while leaving shared realm-level engine initialization intact.

#### Scenario: Dispose a live handle
- **WHEN** a consumer disposes a loaded handle
- **THEN** all handle-owned native objects are destroyed in safe ownership order and cached outlines are released

#### Scenario: Dispose repeatedly
- **WHEN** a consumer calls `dispose` more than once
- **THEN** later calls complete without double destruction or error

#### Scenario: Reject use after disposal
- **WHEN** a consumer calls facts-dependent operations, coverage, shaping, or outline retrieval after disposal
- **THEN** the operation throws `DisposedFontHandleError` without touching released native state

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
`@text-rendering-toolkit/font` MUST add COLR v0/CPAL support without DOM, canvas, SVG, image-decoder, layout, SDF, Three.js, experiment, or second general-purpose font-parser dependencies and MUST retain the accepted fixture provenance in package evidence.

#### Scenario: Consume color layers from the packed font package
- **WHEN** a clean ESM consumer installs the packed package and loads the accepted COLR v0 fixture through its public entry point
- **THEN** it can shape the accepted emoji corpus, resolve ordered color layers, retrieve their ordinary numeric outlines, and dispose the handle without unpublished paths or missing assets

#### Scenario: Preserve non-color font behavior
- **WHEN** existing TTF and CFF fixtures are loaded and used without requesting color layers
- **THEN** their facts, coverage, shaping, variations, outline caching, errors, package contents, and lifecycle remain unchanged

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

### Requirement: Preserve third-party provenance and reproducible evidence
The package MUST record the exact HarfBuzzjs source revision, embedded HarfBuzz version, local wrapper changes, licenses, fixture origins, and integrity hashes, and its conformance tests MUST exercise only the production public entry point.

#### Scenario: Audit runtime provenance
- **WHEN** a contributor inspects the package and root notices
- **THEN** every vendored or adapted HarfBuzz artifact and committed font fixture has attributable source, license, modification notes, and an integrity identifier

#### Scenario: Reproduce package conformance
- **WHEN** a contributor runs the documented workspace checks from a clean install
- **THEN** type checking, shaping snapshots, outline checks, format failures, variation isolation, lifecycle checks, and the packed-consumer smoke test pass without importing implementation code from `experiments/` or `old/`

# Font Engine Core

## Purpose

Define the standalone renderer-neutral font package contract for loading supported font bytes, querying font facts and coverage, shaping explicit text runs, retrieving lazy numeric outlines, and disposing native resources deterministically.

## Requirements

### Requirement: Provide a standalone renderer-neutral font package
The project SHALL expose `@webgpu-text/font` as a strict-TypeScript, ESM-only package whose public entry point can be consumed without `old/`, `experiments/`, DOM APIs, Three.js, layout, SDF, or renderer dependencies.

#### Scenario: Consume the packed package
- **WHEN** a clean ESM consumer installs the packed font package and imports its public entry point
- **THEN** every JavaScript, type declaration, WASM, and generated runtime asset required to load and use a font is present in the package

#### Scenario: Keep implementation details private
- **WHEN** a consumer inspects the public exports and returned values
- **THEN** no HarfBuzz, Emscripten, WASM pointer, internal wrapper, experiment module, or old Troika type is exposed

### Requirement: Load owned font handles from byte sources
The package SHALL asynchronously load an `ArrayBuffer` or `Uint8Array` into an opaque `FontHandle` that owns the native font objects and an exact copy of the supplied byte range.

#### Scenario: Load an ArrayBuffer
- **WHEN** a consumer passes valid supported font bytes in an `ArrayBuffer`
- **THEN** loading resolves to a usable handle with normalized facts

#### Scenario: Respect a Uint8Array view
- **WHEN** a consumer passes a `Uint8Array` whose view covers only part of its backing buffer
- **THEN** loading uses exactly the view's `byteOffset` and `byteLength` and ignores bytes outside that range

#### Scenario: Decouple caller byte lifetime
- **WHEN** the caller mutates or releases its source bytes after loading resolves
- **THEN** subsequent facts, shaping, coverage, and outline results from the handle remain unchanged

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

### Requirement: Preserve third-party provenance and reproducible evidence
The package MUST record the exact HarfBuzzjs source revision, embedded HarfBuzz version, local wrapper changes, licenses, fixture origins, and integrity hashes, and its conformance tests MUST exercise only the production public entry point.

#### Scenario: Audit runtime provenance
- **WHEN** a contributor inspects the package and root notices
- **THEN** every vendored or adapted HarfBuzz artifact and committed font fixture has attributable source, license, modification notes, and an integrity identifier

#### Scenario: Reproduce package conformance
- **WHEN** a contributor runs the documented workspace checks from a clean install
- **THEN** type checking, shaping snapshots, outline checks, format failures, variation isolation, lifecycle checks, and the packed-consumer smoke test pass without importing implementation code from `experiments/` or `old/`

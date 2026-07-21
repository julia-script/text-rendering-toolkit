## ADDED Requirements

### Requirement: Expose reusable raw-text preparation
The layout package SHALL expose a synchronous `prepareText()` operation that
accepts raw text, paragraph direction, a default style, optional half-open UTF-16
style ranges, and partial layout policy and returns a versioned, readonly,
deeply immutable, JSON-serializable `PreparedText` without consulting fonts or
performing shaping or layout.

#### Scenario: Prepare representative text deterministically
- **WHEN** identical multilingual input and immutable style/layout policy are prepared repeatedly
- **THEN** the results are semantically identical, preserve source UTF-16 ranges, contain only serializable data, and leave the caller input unchanged

#### Scenario: Reuse a serialized preparation
- **WHEN** a valid prepared result is serialized, parsed into new object identities, and passed to the font-aware operation
- **THEN** the complete prepared schema is revalidated and produces the same layout as the original value

#### Scenario: Reject an incompatible prepared value
- **WHEN** a caller supplies an unknown schema version, invalid range, non-finite value, or inconsistent prepared segment
- **THEN** the operation fails deterministically before shaping or mutating a font handle

### Requirement: Itemize text at valid Unicode boundaries
`prepareText()` MUST validate Unicode scalar encoding, segment editable graphemes,
resolve whole-text paragraph bidi levels, assign shaping direction and ISO 15924
scripts, intersect styles, normalize layout policy, and coalesce only compatible
adjacent segments while preserving the original text.

#### Scenario: Itemize representative scripts and bidi text
- **WHEN** text contains Latin, Arabic, Devanagari, Khmer, automatic or explicit paragraph direction, mixed bidi content, or bidi controls
- **THEN** prepared segments retain correct UTF-16 ranges, paragraph and embedding levels, direction parity, scripts, and effective shaping styles

#### Scenario: Adopt Common and Inherited graphemes
- **WHEN** punctuation, spaces, combining marks, joiners, or variation selectors occur beside strong-script text
- **THEN** compatible graphemes adopt the nearest strong script within the same paragraph and bidi parity, preferring the preceding run, without creating a standalone mark run

#### Scenario: Preserve editable boundaries
- **WHEN** text contains surrogate pairs, combining sequences, emoji-style joiner sequences, variation selectors, hard breaks, or style changes
- **THEN** no accepted boundary splits a surrogate pair or grapheme, hard breaks remain unshaped source text, and a style transition inside a grapheme is rejected

#### Scenario: Preserve explicit Unicode limits
- **WHEN** preparation dependency versions or Unicode data revisions are inspected
- **THEN** the package documents and tests the pinned Unicode 13 bidi and Unicode 17 script behavior rather than claiming an unspecified current Unicode version

### Requirement: Resolve fonts and shape prepared segments explicitly
The layout package SHALL expose synchronous `layoutPreparedText()` that accepts a
validated `PreparedText` and a caller-owned readonly registry of public
`FontHandle` values, selects fonts at grapheme boundaries, shapes through public
font operations, scales font-unit data exactly once, and invokes the unchanged
resolved layout core.

#### Scenario: Select the first supporting font
- **WHEN** a style's first registered font lacks complete coverage for an editable grapheme and a later preferred font covers it
- **THEN** the whole grapheme resolves to the later stable key and compatible adjacent graphemes may coalesce without changing source coverage

#### Scenario: Apply style-specific shaping
- **WHEN** effective styles change font order, size, language, features, variations, or style identity at valid boundaries
- **THEN** each selected segment is shaped once with explicit direction, script, language, features, and variations, and its metrics, advances, and offsets use `fontSize / unitsPerEm`

#### Scenario: Preserve lazy outline mapping
- **WHEN** prepared text is laid out successfully
- **THEN** positioned glyphs retain stable font/style keys, glyph IDs, variations, and `fontUnitScale` without preparation or shaping calling `getOutline()`

#### Scenario: Reject an unavailable registry key
- **WHEN** an effective style names a font key absent from the caller registry
- **THEN** layout fails deterministically with the source range and attempted keys without fetching or discovering a replacement

#### Scenario: Reject missing grapheme coverage
- **WHEN** no preferred registered font covers a required grapheme after applying the documented default-ignorable policy
- **THEN** layout fails deterministically with that grapheme's UTF-16 range and attempted keys

### Requirement: Offer an equivalent one-call composition
The layout package SHALL expose synchronous `layoutText()` as the convenience
composition of `prepareText()` and `layoutPreparedText()` while preserving
`layoutResolvedText()` as the unchanged expert boundary.

#### Scenario: Compare one-call and reused preparation
- **WHEN** the same valid input and structurally equivalent font registries are processed through both public paths
- **THEN** `layoutText(input, fonts)` and `layoutPreparedText(prepareText(input), fonts)` return semantically identical `LayoutResult` values

#### Scenario: Continue using resolved input directly
- **WHEN** an existing caller supplies `ResolvedLayoutInput` to `layoutResolvedText()`
- **THEN** its output and accepted fixture behavior remain unchanged and no raw-text dependency policy is imposed on that caller

### Requirement: Preserve renderer-neutral output and caller ownership
Raw-text preparation and composition MUST return only the existing
renderer-neutral layout contract and MUST NOT acquire font bytes, own caller font
handles, extract outlines eagerly, or introduce renderer resources or behavior.

#### Scenario: Inspect successful output
- **WHEN** raw text is prepared and laid out
- **THEN** the prepared value and `LayoutResult` contain no font bytes, URLs, font handles, outlines, SDF pixels, atlas slots, Three.js objects, GPU resources, promises, or owned disposal state

#### Scenario: Preserve font-handle ownership
- **WHEN** font-aware layout succeeds or fails
- **THEN** caller handles remain live and unmodified with no disposal, global caching, or hidden registry mutation

#### Scenario: Obtain interaction geometry
- **WHEN** a caller uses the returned `LayoutResult` with existing selection helpers
- **THEN** lines, block bounds, carets, and selection rectangles remain available while visible glyph bounds may be `null` until a consumer resolves outlines lazily

### Requirement: Conform in publishable ESM environments
The production implementation MUST satisfy the committed canonical preparation
corpus and existing resolved-layout fixtures using strict TypeScript and native
ESM without importing the private validation implementation, `old/`, DOM font
loading, network access, SDF, Three.js, or private font modules.

#### Scenario: Run production conformance
- **WHEN** the canonical Latin, Arabic, Devanagari, Khmer, mixed-bidi, boundary, style, fallback, empty, and failure cases run against package exports
- **THEN** prepared segments, font/run selection, layout semantics, deterministic failures, repeated execution, and ownership match the accepted evidence

#### Scenario: Install a clean package consumer
- **WHEN** packed font and layout packages are installed into a clean ESM TypeScript consumer
- **THEN** the new runtime dependencies, declarations, exports, notices, and public APIs resolve and execute without workspace-only paths

#### Scenario: Load in a browser-compatible ESM path
- **WHEN** the production entry is built or imported for a supported browser target
- **THEN** preparation and composition load without CommonJS wrappers, Node-only APIs, renderer dependencies, or network access

## ADDED Requirements

### Requirement: Produce default Unicode line-break opportunities
`prepareText()` SHALL obtain default Unicode line-break opportunities through a project-owned typed adapter around pinned `linebreak@1.1.0`, normalize them to ordered unique UTF-16 boundaries, and retain only boundaries compatible with the prepared text's scalar, grapheme, paragraph, and hard-break structure.

#### Scenario: Prepare optional opportunities
- **WHEN** raw text contains spaces, punctuation, CJK characters, emoji modifiers, regional indicators, or joiner sequences
- **THEN** the prepared value contains deterministic optional opportunities at allowed UTF-16 grapheme boundaries and never splits a surrogate pair or editable grapheme

#### Scenario: Preserve mandatory opportunities
- **WHEN** raw text contains CRLF, CR, LF, or another mandatory break recognized by the pinned algorithm
- **THEN** the prepared value records the normalized source boundary once as required while preserving the original UTF-16 source range used by layout

#### Scenario: Keep preparation font-neutral
- **WHEN** line-break opportunities are prepared
- **THEN** no font registry, shaping result, glyph measurement, layout width, outline, renderer, or platform line-breaking service is consulted

#### Scenario: Disclose the pinned algorithm boundary
- **WHEN** package metadata, public documentation, or conformance evidence is inspected
- **THEN** the implementation identifies `linebreak@1.1.0`, its Unicode 13 data, its MIT license, and the project's local adapter and excluded upstream conformance cases without claiming Unicode 17 or complete browser parity

## MODIFIED Requirements

### Requirement: Expose reusable raw-text preparation
The layout package SHALL expose a synchronous `prepareText()` operation that
accepts raw text, paragraph direction, a default style, optional half-open UTF-16
style ranges, and partial layout policy and returns a versioned, readonly,
deeply immutable, JSON-serializable `PreparedText` containing prepared segments
and normalized Unicode line-break opportunities without consulting fonts or
performing shaping, measurement, or layout.

#### Scenario: Prepare representative text deterministically
- **WHEN** identical multilingual input and immutable style/layout policy are prepared repeatedly
- **THEN** the results are semantically identical, preserve source UTF-16 ranges, contain only serializable data, and leave the caller input unchanged

#### Scenario: Reuse a serialized preparation
- **WHEN** a valid schema-version-2 prepared result is serialized, parsed into new object identities, and passed to the font-aware operation
- **THEN** the complete prepared schema, including break opportunities, is revalidated and produces the same layout as the original value

#### Scenario: Reject an incompatible prepared value
- **WHEN** a caller supplies schema version 1 or another unknown version, an invalid range, a non-finite value, or inconsistent prepared segments or break opportunities
- **THEN** the operation fails deterministically before shaping or mutating a font handle

### Requirement: Resolve fonts and shape prepared segments explicitly
The layout package SHALL expose synchronous `layoutPreparedText()` that accepts a
validated `PreparedText` and a caller-owned readonly registry of public
`FontHandle` values, selects fonts at grapheme boundaries, shapes through public
font operations, selects measured line boundaries from the prepared
opportunities, reshapes fragments at actual line boundaries, scales font-unit
data exactly once, and invokes the resolved layout core.

#### Scenario: Select the first supporting font
- **WHEN** a style's first registered font lacks complete coverage for an editable grapheme and a later preferred font covers it
- **THEN** the whole grapheme resolves to the later stable key and compatible adjacent graphemes may coalesce without changing source coverage

#### Scenario: Apply style-specific shaping
- **WHEN** effective styles change font order, size, language, features, variations, or style identity at valid boundaries
- **THEN** each candidate or final fragment is shaped with explicit direction, script, language, features, and variations, and its metrics, advances, and offsets use `fontSize / unitsPerEm`

#### Scenario: Select the longest measured opportunity
- **WHEN** normal wrapping has a finite width and multiple prepared opportunities occur before overflow
- **THEN** composition selects the furthest allowed boundary whose exactly shaped line fragment fits after indentation and letter spacing, preserving a required boundary regardless of remaining width

#### Scenario: Reshape at an actual line boundary
- **WHEN** a selected soft or required boundary splits a compatible font-selected shaping segment
- **THEN** the final line fragments are shaped independently at that boundary so contextual joining and positioning do not cross lines

#### Scenario: Apply emergency break-word fallback
- **WHEN** no prepared optional opportunity fits and `overflowWrap` is `break-word`
- **THEN** composition selects a shaped-cluster and grapheme boundary without splitting a surrogate pair, grapheme, or HarfBuzz cluster and reshapes the resulting line fragments

#### Scenario: Preserve lazy outline mapping
- **WHEN** prepared text is laid out successfully
- **THEN** positioned glyphs retain stable font/style keys, glyph IDs, variations, and `fontUnitScale` without preparation or shaping calling `getOutline()`

#### Scenario: Reject an unavailable registry key
- **WHEN** an effective style names a font key absent from the caller registry
- **THEN** layout fails deterministically with the source range and attempted keys without fetching or discovering a replacement

#### Scenario: Reject missing grapheme coverage
- **WHEN** no preferred registered font covers a required grapheme after applying the documented default-ignorable policy
- **THEN** layout fails deterministically with that grapheme's UTF-16 range and attempted keys

### Requirement: Conform in publishable ESM environments
The production implementation MUST satisfy the committed Unicode line-break,
canonical preparation, break-sensitive shaping, and existing resolved-layout
fixtures using strict TypeScript and native ESM without importing the private
validation implementation, `old/`, DOM font loading, network access, SDF,
Three.js, or private font modules.

#### Scenario: Run production conformance
- **WHEN** Unicode line-break fixtures and canonical Latin, Arabic, Devanagari, Khmer, CJK, emoji, mixed-bidi, boundary, style, fallback, empty, and failure cases run against package exports
- **THEN** prepared opportunities, selected line boundaries, final reshaping, font/run selection, layout semantics, deterministic failures, repeated execution, and ownership match the accepted evidence

#### Scenario: Install a clean package consumer
- **WHEN** packed font and layout packages are installed into a clean ESM TypeScript consumer
- **THEN** preparation and layout with the pinned line-break runtime load without CommonJS-only entry points, undeclared dependencies, browser globals at module evaluation, workspace paths, or private imports

#### Scenario: Execute in a browser module
- **WHEN** the packed public layout API is imported by the documented browser fixture
- **THEN** representative preparation and measured wrapping execute without Node polyfills, network fetching by core packages, or renderer coupling

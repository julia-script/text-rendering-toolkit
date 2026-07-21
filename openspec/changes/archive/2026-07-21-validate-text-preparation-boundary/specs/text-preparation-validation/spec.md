## ADDED Requirements

### Requirement: Isolate text-preparation validation
The project SHALL provide a strict-TypeScript, ESM-only validation harness for
raw-text preparation that consumes only public font/layout APIs and committed
fixtures without changing a publishable package or depending on `old/`, DOM font
loading, a renderer, or network access.

#### Scenario: Run the validation workspace
- **WHEN** a contributor runs the documented formatting, type, test, and build commands from a clean checkout
- **THEN** the preparation contract, itemization candidates, fixtures, and public-package composition checks execute without fetching data or importing private font/layout modules

#### Scenario: Inspect publishable packages
- **WHEN** the validation change is complete
- **THEN** no production raw-text preparation export, candidate-only dependency, worker, font provider, or renderer behavior has been added

### Requirement: Evaluate a reusable font-independent boundary
The validation MUST model a pure candidate operation that accepts raw text,
layout policy, a default style, and optional UTF-16 style ranges and returns a
readonly serializable preparation result without consulting fonts or performing
shaping or layout.

#### Scenario: Prepare representative text repeatedly
- **WHEN** identical multilingual text and immutable style policy are prepared more than once
- **THEN** the candidate results are semantically identical, preserve original UTF-16 ranges, and leave the input unchanged

#### Scenario: Reuse prepared text with fonts
- **WHEN** one prepared result is passed repeatedly to the font-aware candidate with the same or structurally equivalent explicit registry
- **THEN** font-independent analysis is reusable and each completed result remains deterministic

#### Scenario: Reject a dishonest split
- **WHEN** evidence shows that the first stage merely copies input or embeds font-dependent choices
- **THEN** the report rejects a public prepared value and recommends the smaller single-operation production boundary

### Requirement: Validate Unicode itemization policy
The harness SHALL determine paragraph direction, bidi levels, shaping direction,
ISO 15924 script, and valid segment boundaries for the committed corpus while
preserving UTF-16 source identity and editable grapheme boundaries.

#### Scenario: Itemize representative scripts and bidi text
- **WHEN** cases contain Latin, Arabic, Devanagari, Khmer, explicit or automatic paragraph direction, and mixed-direction text
- **THEN** candidate segments carry accepted source ranges, bidi levels, directions, and scripts suitable for explicit HarfBuzz shaping

#### Scenario: Adopt Common and Inherited characters
- **WHEN** punctuation, spaces, combining marks, joiners, or variation selectors occur beside strong-script text
- **THEN** the accepted policy assigns or preserves them without creating invalid standalone script runs or splitting an editable grapheme

#### Scenario: Preserve JavaScript boundaries
- **WHEN** text contains surrogate pairs, combining sequences, emoji-style joiner sequences, hard breaks, or style transitions
- **THEN** no candidate source range splits a surrogate pair and every accepted split follows the documented grapheme and control policy

### Requirement: Validate explicit-font fallback and shaping
The font-aware candidate MUST use an ordered list of caller-supplied font keys
per effective style, select only registered public `FontHandle` values, and shape
accepted segments through the public font API with explicit direction, script,
language, features, and variations.

#### Scenario: Select the first supporting font
- **WHEN** the first preferred font lacks a complete grapheme cluster and a later registered font supports it
- **THEN** the entire cluster resolves to the later stable font key and adjacent compatible clusters may coalesce without changing source coverage

#### Scenario: Apply style-specific shaping
- **WHEN** style ranges change font order, size, language, features, variations, or style identity at valid boundaries
- **THEN** resolved runs use the applicable public shaping options, scaled metrics and glyph values, and stable style/font keys

#### Scenario: Reject unavailable coverage
- **WHEN** a style names an absent registry key or no preferred font supports a required cluster
- **THEN** validation fails deterministically with the source range and attempted font keys and does not fetch or discover another font

#### Scenario: Preserve caller ownership
- **WHEN** preparation succeeds or fails
- **THEN** no candidate disposes, mutates, caches globally, or otherwise assumes ownership of caller font handles

### Requirement: Compose with the resolved layout core
The accepted font-aware candidate SHALL produce a valid
`ResolvedLayoutInput` and renderer-neutral `LayoutResult` by invoking the public
resolved layout API without changing its existing policy or data contracts.

#### Scenario: Complete representative raw text
- **WHEN** a validated raw-text case resolves and shapes successfully
- **THEN** its scaled runs pass `layoutResolvedText()` and the resulting font keys, positioned glyphs, lines, bounds, carets, and selections match the accepted semantic expectations

#### Scenario: Preserve lower-layer separation
- **WHEN** candidate output and completed layout are inspected
- **THEN** they contain no font bytes, URLs, font ownership, outlines, SDF pixels, atlas slots, Three.js objects, or GPU resources

#### Scenario: Preserve the resolved expert API
- **WHEN** existing callers continue to supply `ResolvedLayoutInput` directly
- **THEN** the current resolved layout behavior and fixtures remain unchanged by validation work

### Requirement: Select and record the production direction
The change MUST compare bounded bidi/script itemization candidates and produce a
committed report that states the accepted or rejected stage split, normative
fallback/style rules, selected dependency or generated-data strategy, Unicode
and package revisions, license/provenance, artifact size, supported first slice,
deferred behavior, and exact recommendation for production implementation.

#### Scenario: Accept an implementation direction
- **WHEN** one bounded approach satisfies every required fixture and boundary check
- **THEN** the report names that approach, reproduces its evidence, and updates architecture and roadmap questions with an implementation-ready contract

#### Scenario: Reject an insufficient candidate
- **WHEN** no candidate satisfies required script, bidi, grapheme, fallback, portability, licensing, or size constraints
- **THEN** the report records the failing cases and bounded next option without expanding the validation change into a production Unicode engine

#### Scenario: Audit every committed observation
- **WHEN** validation fixtures and results are reviewed
- **THEN** each records its evidence layer, source revision or integrity, classification, and rationale, and canonical serialization rejects incomplete or non-finite data

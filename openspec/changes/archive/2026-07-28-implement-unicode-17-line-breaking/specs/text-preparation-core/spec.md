## MODIFIED Requirements

### Requirement: Produce default Unicode line-break opportunities
`prepareText()` SHALL obtain default Unicode line-break opportunities through a
project-owned typed adapter around `@text-rendering-toolkit/linebreak`, normalize them
to ordered unique UTF-16 boundaries, and retain only boundaries compatible with the
prepared text's scalar, grapheme, paragraph, and hard-break structure.

#### Scenario: Prepare optional opportunities
- **WHEN** raw text contains spaces, punctuation, CJK characters, emoji modifiers, regional indicators, or joiner sequences
- **THEN** the prepared value contains deterministic optional opportunities at allowed UTF-16 grapheme boundaries and never splits a surrogate pair or editable grapheme

#### Scenario: Preserve mandatory opportunities
- **WHEN** raw text contains CRLF, CR, LF, or another mandatory break recognized by the algorithm
- **THEN** the prepared value records the normalized source boundary once as required while preserving the original UTF-16 source range used by layout

#### Scenario: Keep preparation font-neutral
- **WHEN** line-break opportunities are prepared
- **THEN** no font registry, shaping result, glyph measurement, layout width, outline, renderer, or platform line-breaking service is consulted

#### Scenario: Disclose the algorithm boundary
- **WHEN** package metadata, public documentation, or conformance evidence is inspected
- **THEN** the implementation identifies `@text-rendering-toolkit/linebreak`, its Unicode 17.0.0 data, and its recorded `LineBreakTest-17.0.0.txt` pass rate without claiming CSS tailoring, dictionary segmentation, hyphenation, or complete browser parity

#### Scenario: Preserve the prepared structure across the swap
- **WHEN** text is prepared after the line-breaking implementation is replaced
- **THEN** the `PreparedText` schema version is unchanged and opportunities remain ordered, unique, in-range UTF-16 offsets carrying a required flag

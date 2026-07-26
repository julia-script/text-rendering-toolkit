## MODIFIED Requirements

### Requirement: Prove compatibility with the public font package
The validation SHALL include a bounded pinned-font matrix that shapes explicit resolved runs only through the public `@text-rendering-toolkit/font` entry point and translates the returned data into the draft resolved-run contract.

#### Scenario: Translate representative real runs
- **WHEN** pinned Latin, Arabic, Devanagari, Khmer, combining-mark, supplementary-plane, and explicit mixed-direction runs are shaped
- **THEN** glyph IDs, UTF-16 clusters, advances, offsets, flags, variations, and font identity populate the draft contract without importing font internals

#### Scenario: Keep policy expectations stable
- **WHEN** a real-font observation changes because an engine or fixture revision is intentionally updated
- **THEN** synthetic layout-policy expectations remain unchanged unless the layout contract itself is deliberately revised

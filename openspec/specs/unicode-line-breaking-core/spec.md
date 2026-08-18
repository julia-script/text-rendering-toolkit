# unicode-line-breaking-core Specification

## Purpose
TBD - created by archiving change implement-unicode-17-line-breaking. Update Purpose after archive.
## Requirements
### Requirement: Implement UAX #14 as ordered rules with carried state
The package SHALL implement the Unicode line-breaking algorithm as the specification's
ordered rules evaluated over adjacent positions with explicit carried state, and SHALL
NOT rely on a class-by-class pair table as its decision mechanism. Rules requiring
context beyond the adjacent pair — at minimum LB8a joiner sequences, LB21a Hebrew
letter after hyphen, LB25 numeric sequences, and LB30a regional-indicator pairing —
SHALL be decided from that carried state.

#### Scenario: Decide a regional-indicator pair
- **WHEN** a run of regional indicators is analyzed
- **THEN** a break opportunity is produced after each even-numbered pair and suppressed
  within a pair, so flag sequences are not divided

#### Scenario: Suppress a break inside a joiner sequence
- **WHEN** text contains a zero-width joiner between pictographic characters
- **THEN** no optional opportunity is produced inside the joined sequence

#### Scenario: Decide a Hebrew letter after a hyphen
- **WHEN** a Hebrew letter follows a hyphen or break-after character that itself
  follows a Hebrew letter
- **THEN** the opportunity is suppressed according to LB21a rather than by the default
  pair decision

#### Scenario: Reject a pair-table decision mechanism
- **WHEN** the implementation source is inspected
- **THEN** break decisions derive from ordered rule evaluation and named carried state,
  and no two-dimensional class-by-class break matrix is consulted

### Requirement: Own Unicode 17.0.0 property data through a checked-in generator
The package SHALL derive its line-break class, East Asian Width, general-category, and
emoji property tables from vendored Unicode 17.0.0 UCD files using a checked-in
generator, and SHALL record the exact Unicode version in package metadata and public
documentation. Generated tables SHALL be committed so that consumers require no
network access or generation step.

#### Scenario: Regenerate tables deterministically
- **WHEN** the generator runs against the vendored Unicode 17.0.0 UCD files
- **THEN** it reproduces the committed tables byte-for-byte

#### Scenario: Resolve a Unicode 17 class
- **WHEN** a code point whose line-break class was introduced or changed in Unicode 17
  is looked up
- **THEN** the resolved class matches the vendored `DerivedLineBreak.txt` assignment

#### Scenario: Disclose the data version
- **WHEN** package metadata or public documentation is inspected
- **THEN** it identifies Unicode 17.0.0, the vendored UCD sources, and their license
  without claiming CSS, locale, or browser parity

### Requirement: Meet a recorded conformance pass rate
The package SHALL be validated against the official `LineBreakTest-17.0.0.txt` corpus,
SHALL record its pass rate as project-owned evidence, and SHALL enumerate every case it
does not satisfy together with the rule involved. A case SHALL NOT be excluded from the
corpus without a recorded reason.

#### Scenario: Run the conformance corpus
- **WHEN** the conformance suite executes
- **THEN** every case in `LineBreakTest-17.0.0.txt` is evaluated and the pass rate is
  reported

#### Scenario: Attribute a failing case
- **WHEN** a conformance case does not pass
- **THEN** the evidence record names the case, its code points, and the rule involved
  rather than reporting an aggregate count alone

### Requirement: Produce deterministic UTF-16 opportunities
The package SHALL expose break opportunities as ordered, unique, in-range JavaScript
UTF-16 offsets with a required flag, SHALL never place an opportunity inside a
surrogate pair, and SHALL be pure, synchronous, and free of font, layout, renderer,
platform, and network access.

#### Scenario: Produce offsets for astral text
- **WHEN** text containing supplementary-plane characters is analyzed
- **THEN** every reported offset is a valid UTF-16 boundary and no offset divides a
  surrogate pair

#### Scenario: Report a mandatory break once
- **WHEN** text contains CRLF, CR, LF, or another mandatory break control
- **THEN** the corresponding boundary is reported exactly once and flagged as required

#### Scenario: Stay independent of higher layers
- **WHEN** opportunities are produced
- **THEN** no font, shaping result, glyph measurement, layout width, renderer, platform
  line-breaking service, or network resource is consulted

### Requirement: Decide numeric sequences from forward-carried state
The package SHALL decide LB25 numeric-sequence rules from state carried forward during
analysis, and SHALL NOT scan backward through previously analyzed text to reach a
decision.

#### Scenario: Decide a numeric sequence
- **WHEN** text contains a numeric run followed by separators and a prefix or postfix
  character
- **THEN** the LB25 decision matches the conformance corpus without re-reading earlier
  positions

#### Scenario: Reject backward scanning
- **WHEN** the implementation source is inspected
- **THEN** no reverse iteration over analyzed text is used to decide a break

### Requirement: Gate the streaming driver on measured cost
A streaming driver, if provided, SHALL be built over the same rule core as batch
analysis, SHALL produce output identical to batch analysis for every conformance case
under every input split, SHALL retain no more analyzed text than its pending decision
requires, and SHALL have its measured cost relative to batch analysis recorded as
project evidence. If the measured cost is not acceptable, the driver SHALL NOT ship and
the batch implementation SHALL remain the only public surface.

#### Scenario: Match batch output across input splits
- **WHEN** a conformance case is supplied to the streaming driver in chunks split at
  every possible boundary
- **THEN** the emitted opportunities are identical to batch analysis of the same text

#### Scenario: Decide across a chunk boundary
- **WHEN** a decision requires a character that has not yet been supplied
- **THEN** the driver withholds the decision until that character arrives rather than
  deciding from absent input

#### Scenario: Record the measured comparison
- **WHEN** the streaming driver is evaluated
- **THEN** its cost relative to batch analysis is recorded as a local characterization,
  and the decision to ship or drop it cites that measurement


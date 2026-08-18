## Why

Line breaking is pinned to `linebreak@1.1.0`, whose Unicode 13 data is four major
versions behind the project's own Unicode 17 script data. The gap cannot be closed by
regenerating tables: that dependency is pair-table based, and UAX #14 deleted its
"Pair Table-Based Implementation" section no later than Unicode 13.0.0 revision 45
(2020-02-17), with the section still marked "Deleted." in 17.0.0 revision 55
(2025-09-05). Rules that require carried context — LB8a ZWJ sequences, LB21a Hebrew
letter after hyphen, LB30a regional-indicator pairing — cannot be expressed as
class-by-class matrix cells, and the dependency carries them as per-instance flags
bolted beside its table. Newer Unicode versions keep adding rules of that kind, so
reaching current conformance requires a rule-based implementation of the
specification's section 6 rather than newer data.

## What Changes

- Add a new `@text-rendering-toolkit/linebreak` package owning a rule-based UAX #14
  implementation targeting Unicode 17.0.0, replacing the pinned `linebreak@1.1.0`
  dependency behind the existing internal adapter.
- Generate line-break, East Asian Width, general-category, and emoji property tables
  from vendored Unicode 17.0.0 UCD files into typed arrays, with a checked-in
  generator and vendored source data.
- Establish `LineBreakTest-17.0.0.txt` (19,338 cases) as the normative conformance
  corpus, replacing the current arrangement in which roughly 50 upstream cases are
  documented as skipped without a project-owned pass rate.
- Implement the Unicode 17 rule set from the normative UAX #14 text, including the
  `HH` class and the rules with no counterpart in the reference implementation —
  LB15a through LB15d, LB19a, LB20a, LB21b, LB23a, LB28a, part of LB30b, and the
  restructured LB25.
- Replace LB25's backward numeric scan with forward-carried state, removing reverse
  string iteration from the hot path.
- Evaluate an optional streaming driver over the same rule core against a batch
  benchmark, and ship it only if its measured cost is acceptable.
- Remove the `linebreak@1.1.0` dependency, its declaration, and its third-party
  notice once the replacement passes the corpus and existing layout fixtures.
- **BREAKING** for consumers who rely on exact Unicode 13 break positions: some
  boundaries change to match Unicode 17. `PreparedText` structure is unchanged, so
  the schema version does not move.

## Capabilities

### New Capabilities
- `unicode-line-breaking-core`: A rule-based UAX #14 implementation with project-owned
  Unicode 17.0.0 property tables, a conformance-corpus pass rate, deterministic
  UTF-16 opportunity output, and an optional streaming driver over the same rule core.

### Modified Capabilities
- `text-preparation-core`: The "Produce default Unicode line-break opportunities"
  requirement currently mandates a typed adapter around pinned `linebreak@1.1.0` and
  requires disclosing its Unicode 13 data and excluded upstream conformance cases.
  Both the named dependency and the disclosed data version change, and the disclosure
  becomes a measured corpus pass rate rather than a list of excluded cases.

## Impact

- **New package**: `packages/linebreak` — currently a blank scaffold with no consumers,
  so it can absorb this work without affecting published surfaces until the swap.
- **Modified**: `packages/layout` — `src/internal/line-break.ts` (the intended swap
  point), `package.json` dependency removal, `THIRD_PARTY_NOTICES.md`, `README.md`.
- **Dependencies**: removes `linebreak@1.1.0`; adds no runtime dependency, since the
  tables are generated into the new package.
- **Evidence**: adds a conformance record under `docs/validation/`; updates
  `docs/validation/unicode-line-breaking.md` with post-swap composition observations.
- **Unaffected**: `PreparedText` schema version, `LayoutResult`, the resolved expert
  API, font, SDF, and renderer packages. Preparation stays font-neutral and
  synchronous.
- **Reference material**: an existing Zig implementation at
  `packages/core/src/uni/LineBreak.zig` in a separate local repository informs the rule
  structure and carried-state design. It is a reference, not a port source; its
  UTF-8 byte iteration and backward numeric scan are deliberately not reproduced.
- **Out of scope**: CSS/locale `line-break`/`word-break` tailoring, dictionary
  segmentation for complex-context scripts, hyphenation, optimal paragraph-wide
  breaking, and complete browser parity.

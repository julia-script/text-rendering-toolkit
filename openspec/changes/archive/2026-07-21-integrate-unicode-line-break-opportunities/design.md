## Context

`prepareText()` currently serializes grapheme, bidi, script, style, and layout-policy analysis as schema version 1. `layoutPreparedText()` selects fonts, shapes each compatible segment once, and passes the resulting runs to `layoutResolvedText()`, whose line constructor recognizes CR/LF hard breaks, whitespace soft breaks, and grapheme-safe `break-word` fallback. That boundary is deterministic and renderer-neutral, but it cannot express the default Unicode opportunities needed for punctuation, CJK, emoji sequences, or other non-whitespace wrapping.

`linebreak@1.1.0` is a small MIT implementation of UAX #14 that provides UTF-16 positions plus a required flag and publishes an ESM entry. It intentionally does not measure text, choose actual lines, reshape at selected boundaries, perform dictionary segmentation, or implement browser CSS tailoring. Its generated tables and documented conformance target Unicode 13, while the project currently documents Unicode 13 bidi and Unicode 17 script data.

The existing public font contract already shapes arbitrary substrings synchronously and returns source clusters and opaque HarfBuzz glyph flags. No font, SDF, Three, or renderer API change is required.

## Goals / Non-Goals

**Goals:**

- Replace whitespace-only raw-text opportunities with deterministic default Unicode opportunities from a pinned, attributed dependency.
- Keep preparation immutable, serializable, font-neutral, and reusable.
- Preserve existing `whiteSpace`, `overflowWrap`, indentation, spacing, bidi placement, caret, selection, and renderer-neutral output contracts.
- Shape final line fragments independently so contextual joining and positioning do not cross selected boundaries.
- Preserve legacy `layoutResolvedText()` behavior for callers that omit explicit opportunities.
- Prove ESM, browser, package, Unicode-fixture, public-font, and regression behavior before describing the result as broader text fidelity.

**Non-Goals:**

- Unicode 17 data, locale or CSS `line-break`/`word-break` tailoring, dictionary segmentation, hyphenation, or optimal paragraph-wide breaking.
- Incremental editing, asynchronous or worker shaping, line-result caching, or a new public session object.
- Font fetching, font ownership, outlines, SDFs, renderer changes, color-glyph policy, or interaction-affinity changes.
- Preserving serialized schema-version-1 `PreparedText` values.
- Claiming complete browser parity or using browser layout as the production algorithm.

## Decisions

### Use `linebreak@1.1.0` directly behind one internal adapter

The layout package will pin the exact dependency version and add a local declaration plus an internal adapter whose output is the project-owned readonly shape:

```ts
interface LineBreakOpportunity {
  readonly position: number
  readonly required: boolean
}
```

The adapter will consume the iterator, reject malformed or non-progressing output, sort and deduplicate defensively, preserve a required flag when duplicates collide, intersect optional positions with prepared grapheme boundaries, and include the terminal source boundary exactly once. Required controls will be normalized with the source so CRLF remains one break and every stored position remains a JavaScript UTF-16 offset.

This is preferable to implementing UAX #14 locally: the dependency already carries generated Unicode data and a conformance corpus. It is preferable to exporting the dependency's class because public callers need stable serializable data, not an iterator or dependency-owned types. If clean ESM/browser validation fails or the accepted fixture corpus exposes a blocking upstream divergence, implementation pauses for an artifact update rather than silently vendoring or forking it.

### Bump `PreparedText` to schema version 2

`PreparedText` will add a deeply frozen `breakOpportunities` array and change its literal schema version from 1 to 2. Validation will require ordered, unique, in-range UTF-16 positions, valid grapheme boundaries, consistent required controls, and one terminal boundary. Parsed version-1 values fail through the existing incompatible-version error path.

The version bump makes cached or transported analysis honest: consumers never mistake a whitespace-era preparation for Unicode-aware input. A migration helper is unnecessary because callers can deterministically rerun `prepareText()` from the raw input they already chose to serialize.

### Keep explicit opportunities optional on the resolved expert input

`ResolvedLayoutInput` will accept an optional readonly opportunity list using the same structural type. Omission preserves all accepted whitespace and emergency-wrap fixtures. Presence selects only supplied soft opportunities, while required positions always split lines and `whiteSpace: 'nowrap'` suppresses only optional wrapping.

The resolved core validates that opportunities do not split UTF-16 scalars, graphemes, or shaped clusters. It remains pure and never imports `linebreak`, accesses fonts, or reshapes. This allows raw composition to carry prepared policy into the core without imposing it on expert callers.

### Use provisional layout followed by exact boundary shaping

Raw composition will continue selecting fonts before line fitting. It first shapes the full compatible selected segments and performs a provisional resolved layout with every prepared opportunity. For each provisional soft boundary it then shapes the exact logical line fragments as standalone substrings using the existing `FontHandle.shape()` options.

If exact boundary shaping changes width around the provisional choice, the composer probes adjacent legal candidates in source order: it retreats until one fits, then advances until the next exact candidate overflows. Fragment shapes are memoized for the duration of one call by source range plus selected shape identity. The accepted candidate is therefore the greedy last exactly measured opportunity before overflow rather than an estimate from paragraph shaping.

After all actual boundaries stabilize, the composer calls the resolved core with final line-fragment runs and only the selected soft/required break plan. Bidi levels remain whole-text preparation data; visual reordering still occurs independently per final line. No intermediate result or cache escapes the synchronous call.

This correctness-first pass may shape a boundary fragment more than once, but it avoids changing the font API, exposing HarfBuzz buffer flags, or allowing contextual forms to join across lines. Optimization requires measurements from this implementation rather than a speculative worker or cache surface.

### Treat upstream Unicode and browser behavior as explicit evidence boundaries

Tests will retain a bounded copy or generated projection of relevant Unicode 13 `LineBreakTest` cases plus focused project fixtures for punctuation, spaces, CJK, combining sequences, ZWJ emoji, emoji modifiers, regional indicators, bidi text, CRLF and other mandatory controls. Public-font fixtures will prove actual line selection and Arabic or other contextual reshaping. A browser observation fixture will compare selected representative boundaries without treating browser output as a portable normative oracle.

Documentation will state that Southeast Asian complex-context classes still require language-specific segmentation, newer Unicode assignments may differ, and CSS/locale tailoring remains future work. The roadmap item stays in progress rather than claiming complete browser-grade line breaking after this bounded slice.

## Risks / Trade-offs

- **[Unicode 13 tables age poorly for new scripts and emoji]** → Pin and disclose the version, include newer-code-point characterization fixtures, and keep the dependency behind a replaceable adapter.
- **[Upstream skips part of its conformance corpus]** → Record the exact accepted/skipped cases relevant to this project and block implementation if a skipped rule violates the required fixture set.
- **[Candidate reshaping increases synchronous work]** → Memoize within one composition, benchmark long Latin and opportunity-dense CJK paragraphs, and record observations without inventing a performance guarantee.
- **[Required break controls differ from the existing CR/LF model]** → Normalize and test each accepted mandatory control, exclude its source control from shaped content, and preserve logical source ranges in line records.
- **[Optional resolved-input behavior can create two policies]** → Keep omission explicitly legacy-compatible, centralize validation and line construction, and run both fixture families through the same core.
- **[Browser output is tailored and platform-dependent]** → Use browser cases as documented observations only; Unicode/project fixtures remain normative.
- **[Schema version 2 invalidates stored analysis]** → Fail loudly and direct consumers to rerun deterministic preparation from raw input.

## Migration Plan

1. Add and validate the pinned dependency, declaration, license metadata, and internal adapter in Node, clean-package ESM, and browser environments.
2. Introduce schema-version-2 opportunities and update preparation validation, fixtures, serialization tests, and public types.
3. Extend the resolved core with optional explicit opportunities while keeping every legacy fixture unchanged.
4. Add exact boundary shaping and final break-plan composition to the raw-text path, then validate contextual public-font cases and bounded performance observations.
5. Update consumers, documentation, validation records, dependency locks, release-candidate checks, and the roadmap.

Rollback removes the dependency and explicit-opportunity path and restores schema version 1 and whitespace-only raw wrapping. Because schema version 2 is explicit and unpublished values are caller-regenerable, no ambiguous data downgrade is required.

## Open Questions

- Do the upstream Unicode 13 skipped cases intersect the project's accepted punctuation, CJK, emoji, or break-sensitive fixture set strongly enough to require an attributed local data/algorithm update before production integration?
- What measured paragraph size makes exact candidate probing too expensive for the synchronous path, and does that evidence justify a later worker or specialized cache rather than changing this change's public API?

## Correction (2026-07-28)

This section is appended after archiving. The body above is left unchanged as the
record of what was decided on 2026-07-21; this note records what was later found to
be wrong about the premise.

**The risk framing was wrong about the nature of the limitation.** The risk register
above treats the dependency's age as a *data* problem — "Unicode 13 tables age poorly
for new scripts and emoji", mitigated by regenerating tables behind a replaceable
adapter. That mitigation cannot work, because the ceiling is the mechanism, not the
tables.

`linebreak@1.1.0` is pair-table based. Its bundled runtime exposes `getPairTableBreak`
alongside `getSimpleBreak`, plus per-instance `LB8a`, `LB21a`, and `LB30a` flags —
carried state for the three rules that a class-by-class matrix cannot express (ZWJ
sequences, Hebrew letter after hyphen, and regional-indicator pairing, which needs an
even/odd count rather than a stateless lookup). Character classes come from a
base64-encoded trie of 3,870 decoded bytes, which is orthogonal to this issue.

**UAX #14 deleted the pair-table section outright.** Section 7, formerly "Pair
Table-Based Implementation", reads "Deleted." in the current Unicode 17.0.0 revision 55
(2025-09-05). It also already read "Deleted." in Unicode 13.0.0 revision 45
(2020-02-17) — the exact version this dependency documents conformance to. The removal
predates rev 45; the precise revision that removed it has not been pinned. The spec now
defines the algorithm through Section 6's ordered rules with carried context.

**Consequence for the roadmap.** Regenerating tables against newer Unicode data cannot
bring a pair-table implementation to current conformance, because the rules it cannot
express are exactly the emoji, regional-indicator, and Hebrew ones that later versions
keep adding to. Closing this gap requires a rule-based implementation following
Section 6, not a data refresh. The replaceable adapter at
`packages/layout/src/internal/line-break.ts` remains the correct swap point, so the
adapter decision above still holds even though its stated rationale does not.

The first open question above is therefore answered in a stronger form than it was
asked: the issue is not which upstream cases are skipped, but that the implementation
strategy was removed from the specification before the targeted version.

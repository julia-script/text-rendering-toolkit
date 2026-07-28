# Unicode 17 line-breaking conformance

Evidence for `@text-rendering-toolkit/linebreak`, the rule-based UAX #14
implementation that replaces the pair-table `linebreak@1.1.0` dependency.

## Conformance

| Corpus | Cases | Passed | Rate |
| --- | ---: | ---: | ---: |
| `LineBreakTest-17.0.0.txt` | 19,338 | 19,338 | **100.000%** |

No case is excluded. The corpus is fetched on demand by
`packages/linebreak/scripts/fetch-corpus.ts`, verified against a pinned SHA-256
digest, and run by the package test suite, so a regression names the failing case
and the rules the corpus cited for it. An absent corpus fails the suite with the
fetch command rather than passing silently.

The harness is validated against degenerate implementations so that the rate
means something: an implementation reporting no opportunities scores 0.000%, one
breaking at every offset scores 9.355%, and replaying the corpus's own
expectations scores 100.000%. The last of these confirms the target is reachable,
so any shortfall would be the implementation rather than the harness.

## Property data

Tables are generated from the vendored Unicode 17.0.0 Character Database by
`packages/linebreak/scripts/generate-tables.ts` and committed. Regeneration is
byte-for-byte reproducible.

Two details of the data were load-bearing and are recorded because they are easy
to miss:

- `DerivedLineBreak.txt` carries `@missing` annotations that assign
  **block-specific defaults** to unassigned code points — for example
  `1FC00..1FFFD; Ideographic`. Ignoring them resolves reserved code points such
  as U+1FFFD to AL instead of ID and suppresses breaks the corpus expects. An
  early implementation ignored `@missing` and plateaued at 96.7% for this reason.
- The generator throws on an unrecognized line-break class rather than defaulting
  it, so a future Unicode version that adds a class fails loudly instead of
  silently misclassifying it.

## Rule coverage

All 44 rules of UAX #14 revision 55 are implemented, evaluated in specification
order against explicit carried state. No class-by-class pair table is used; the
specification deleted that section no later than Unicode 13.0.0 revision 45
(2020-02-17), and it remains deleted in 17.0.0 revision 55 (2025-09-05).

LB25 is decided from state carried **forward**, not by scanning backward over
analyzed text. This was adopted for JavaScript ergonomics — reverse UTF-16
iteration is awkward and allocates — and turned out to be what makes bounded
streaming retention possible.

## Streaming

A `LineBreakStream` driver runs over the same rule core as batch analysis.

**Equivalence.** Streaming output is identical to batch output for every corpus
case under **every two-way split** — 83,716 split points — and when fed one
character at a time. Chunk boundaries that divide a surrogate pair or a combining
sequence are held back until the sequence completes.

**Withholding.** A decision requiring a character that has not arrived is
withheld rather than answered from absent input. The deepest lookahead in the
rule set is LB25's `(PO | PR) × OP IS NU`, at three positions past the break.

**Retention.** Peak retained text over a 108,000-unit stream was **5 UTF-16
units**. Retention is bounded by pending lookahead plus one position of LB28a
lookbehind, not by total input.

**Cost.** Median of nine runs after one warm-up, Node.js 24.2.0, Darwin arm64,
Apple M1 Max. This is a local characterization, not a benchmark or a throughput
guarantee.

| Input | Units | Batch | Stream (1 KB chunks) | Stream (64 B chunks) |
| --- | ---: | ---: | ---: | ---: |
| Repeated Latin sentence | 18,000 | 19.31 ms | 15.25 ms (0.79×) | 15.45 ms (0.80×) |
| Japanese prose | 6,400 | 9.28 ms | 9.29 ms (1.00×) | 9.76 ms (1.05×) |
| Mixed Latin, CJK, emoji, numbers | 11,400 | 8.56 ms | 8.18 ms (0.96×) | 8.71 ms (1.02×) |

**Decision: ship it.** Streaming is not slower than batch — it is slightly faster
on Latin, where batch materializes the whole folded-position array up front while
the stream works in a small window with better locality. Chunk size has
negligible effect. The pre-implementation concern was that a backward numeric
scan would force unbounded retention and repeated re-scanning; replacing that
scan with forward-carried state removed the cause.

`@text-rendering-toolkit/layout` consumes complete strings synchronously and uses
the batch entry point. Streaming is an independent capability for callers that
have text arriving incrementally.

## Scope

Excluded, and unchanged by this work: CSS and locale `line-break` / `word-break`
tailoring, dictionary segmentation for complex-context scripts, automatic
hyphenation, optimal paragraph-wide breaking, and complete browser parity.
Choosing actual lines requires glyph measurement and remains the caller's.

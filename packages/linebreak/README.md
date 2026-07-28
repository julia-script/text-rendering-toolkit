# @text-rendering-toolkit/linebreak

A rule-based implementation of the Unicode line breaking algorithm
([UAX #14](https://www.unicode.org/reports/tr14/) revision 55), targeting
Unicode 17.0.0.

It answers one question — where may a line be broken? — and returns ordered
JavaScript UTF-16 offsets. It has no runtime dependencies, touches no browser or
Node global, and is independently installable.

## Usage

```ts
import { findLineBreakOpportunities } from '@text-rendering-toolkit/linebreak'

findLineBreakOpportunities('Hello world')
// [ { position: 6, required: false }, { position: 11, required: true } ]
```

Each `position` is the UTF-16 offset *before* which a line may be broken.
`required` marks a mandatory break — a hard line break (LB4, LB5) or the
terminal boundary, which LB3 always reports.

Offsets are always valid UTF-16 boundaries, so an opportunity never divides a
surrogate pair.

## Conformance

Passes **all 19,338 cases** of the official `LineBreakTest-17.0.0.txt`
conformance corpus, with no case excluded.

The corpus is ~3.9 MB of generated test data, so it is fetched rather than
committed. `pnpm test` downloads it automatically through a `pretest` hook and
verifies it against a pinned SHA-256 digest; the tests fail with the fetch
command rather than passing silently if it is absent. Fetch it explicitly with:

```bash
pnpm --filter @text-rendering-toolkit/linebreak corpus:fetch
```

The property files the generator reads are small and stay committed, so building
the package never requires network access.

Property tables are generated from the vendored Unicode Character Database by
`scripts/generate-tables.ts` and committed, so consumers need no generation step
or network access. Regenerate with:

```bash
pnpm --filter @text-rendering-toolkit/linebreak tables:generate
```

The generator fails on an unrecognized line-break class rather than defaulting
it, so a future Unicode version cannot silently resolve a new class to the wrong
behavior.

## Why not a pair table

Many implementations decide breaks with a two-dimensional table indexed by the
classes of two adjacent characters. UAX #14 deleted that approach: section 7,
"Pair Table-Based Implementation", already read "Deleted." in Unicode 13.0.0
revision 45 (2020-02-17) and still does in 17.0.0 revision 55 (2025-09-05).

The reason is that several rules cannot be expressed as a matrix cell, because
they depend on context beyond the adjacent pair:

| Rule | Why a table cannot express it |
| --- | --- |
| LB8a | A joiner suppresses breaks across a whole emoji ZWJ sequence |
| LB21a | Needs the character *before* the hyphen |
| LB25 | Matches `NU (SY \| IS)*` sequences of unbounded length |
| LB30a | Requires an even/odd count of preceding regional indicators |

This package instead evaluates the rules in specification order against explicit
carried state, so each rule reads the context it needs. LB25 in particular is
decided from state carried *forward*, never by scanning backward over analyzed
text.

## Scope

Out of scope: CSS and locale `line-break` / `word-break` tailoring, dictionary
segmentation for complex-context scripts such as Thai and Khmer, automatic
hyphenation, optimal paragraph-wide breaking, and complete browser parity.

Choosing actual lines is also out of scope, because it requires glyph
measurement. This package reports where breaks are *permitted*; the caller
measures text and decides which opportunities to use.

## License

MIT. Bundled Unicode data is covered by the
[Unicode Terms of Use](https://www.unicode.org/terms_of_use.html); see
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

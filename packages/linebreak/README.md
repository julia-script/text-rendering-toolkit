# @text-rendering-toolkit/linebreak

A rule-based implementation of the Unicode line breaking algorithm
([UAX #14](https://www.unicode.org/reports/tr14/) revision 55), targeting
Unicode 17.0.0.

It answers one question — where may a line be broken? — and returns ordered
JavaScript UTF-16 offsets. No runtime dependencies, no browser or Node globals,
no font, renderer, or network access. Passes all 19,338 cases of the official
conformance corpus.

## Usage

```ts
import { findLineBreakOpportunities } from '@text-rendering-toolkit/linebreak'

findLineBreakOpportunities('Hello world')
// [ { position: 6, required: false },
//   { position: 11, required: true } ]
```

Each `position` is the UTF-16 offset *before* which a line may be broken.
`required` marks a mandatory break — a hard line break (LB4, LB5) or the
terminal boundary, which LB3 always reports.

Offsets are always valid UTF-16 boundaries, so an opportunity never divides a
surrogate pair.

The algorithm knows more than "break at spaces". It keeps `1,234.56` and `a-b`
together, holds emoji ZWJ sequences and flag pairs intact, and finds the
boundaries between CJK characters that have no spaces at all:

```ts
findLineBreakOpportunities('a-b 1,5').map((o) => o.position)
// [ 2, 4, 7 ]  — after the hyphen and the space, but never inside "1,5"
```

### Choosing lines

This package reports where breaks are *permitted*. Which ones to use is the
caller's decision, because it depends on measured glyph widths:

```ts
const opportunities = findLineBreakOpportunities(paragraph)

for (const { position, required } of opportunities) {
  // `required` must be honoured — it is a hard line break or end of text.
  // Otherwise, measure `paragraph.slice(lineStart, position)` and decide.
}
```

A real wrapper also has to handle text that fits no opportunity at all (a long
unbroken word), and choose between greedy and paragraph-optimal strategies.
`@text-rendering-toolkit/layout` implements greedy wrapping with exact
per-fragment shaping on top of this package.

### Streaming

For text that arrives incrementally, `LineBreakStream` produces identical output
without holding the whole string. It withholds any decision that needs a
character which has not arrived, and releases text once decided — peak retention
measured at 5 UTF-16 units over a 108,000-unit stream.

```ts
import { LineBreakStream } from '@text-rendering-toolkit/linebreak'

const stream = new LineBreakStream()
stream.append('Hello ')   // → []  — withheld; later text could still change it
stream.append('world')    // → [ { position: 6, required: false } ]
stream.end()              // → [ { position: 11, required: true } ]
```

Note the first call returns nothing. Some rules look ahead up to three
characters, so an opportunity is reported only once enough text has arrived to
decide it — never guessed from a partial buffer. Concatenating everything the
stream returns gives exactly what `findLineBreakOpportunities` would produce for
the whole string.

Chunk boundaries may fall anywhere, including inside a surrogate pair or a
combining sequence. Verified against batch analysis across all 83,716 two-way
splits of the conformance corpus.

## API

| Export | Purpose |
| --- | --- |
| `findLineBreakOpportunities(text)` | Every opportunity in a complete string |
| `LineBreakStream` | Incremental analysis over arriving text |
| `LineBreakOpportunity` | `{ position: number; required: boolean }` |
| `UNICODE_VERSION` | `'17.0.0'` — the data these tables came from |

## Conformance

Passes **19,338 / 19,338** cases of the official `LineBreakTest-17.0.0.txt`
corpus, with no case excluded.

The corpus is ~3.9 MB of generated test data, so it is fetched rather than
committed. `pnpm test` downloads it through a `pretest` hook and verifies a
pinned SHA-256 digest; if it is absent the tests fail with the fetch command
rather than passing silently. Fetch it explicitly with:

```bash
pnpm --filter @text-rendering-toolkit/linebreak corpus:fetch
```

Property tables are generated from vendored Unicode Character Database files and
committed, so building never needs the network:

```bash
pnpm --filter @text-rendering-toolkit/linebreak tables:generate
```

The generator throws on an unrecognized line-break class rather than defaulting
it, so a future Unicode version cannot silently resolve a new class to the wrong
behavior.

## Why not a pair table

Many implementations decide breaks with a two-dimensional table indexed by the
classes of two adjacent characters. UAX #14 deleted that approach: section 7,
"Pair Table-Based Implementation", already read "Deleted." in Unicode 13.0.0
revision 45 (2020-02-17) and still does in 17.0.0 revision 55 (2025-09-05).

Several rules cannot be expressed as a matrix cell, because they depend on
context beyond the adjacent pair:

| Rule | Why a table cannot express it |
| --- | --- |
| LB8a | A joiner suppresses breaks across a whole emoji ZWJ sequence |
| LB21a | Needs the character *before* the hyphen |
| LB25 | Matches `NU (SY \| IS)*` sequences of unbounded length |
| LB30a | Requires an even/odd count of preceding regional indicators |

This package evaluates the rules in specification order against explicit carried
state, so each rule reads the context it needs. LB25 is decided from state
carried *forward*, never by scanning backward over analyzed text — which is also
what lets the streaming driver discard what it has already consumed.

### What that costs

Ordered rule evaluation is slower than one table lookup. Measured against
`linebreak@1.1.0`, the pair-table implementation this package replaced, on
identical output:

| Input | Units | Pair table | This package |
| --- | ---: | ---: | ---: |
| Latin prose | 18,000 | 0.31 ms | 7.66 ms |
| CJK prose | 6,400 | 0.15 ms | 1.90 ms |
| Mixed content | 11,400 | 0.23 ms | 4.40 ms |
| Emoji sequences | 10,000 | 0.15 ms | 3.09 ms |
| Arabic | 12,600 | 0.24 ms | 4.67 ms |

Roughly 19× in exchange for conformance a pair table cannot reach at any speed —
that implementation is pinned to Unicode 13 and carries its stateful rules as
flags bolted beside the table. In a full text layout, shaping dominates by orders
of magnitude and line breaking is a low single-digit percentage of the work.

See [the validation record](../../docs/validation/unicode-17-line-breaking.md)
for the full measurement methodology and the optimizations that were tried and
rejected.

## Scope

Out of scope: CSS and locale `line-break` / `word-break` tailoring, dictionary
segmentation for complex-context scripts such as Thai and Khmer, automatic
hyphenation, optimal paragraph-wide breaking, and complete browser parity.

Choosing actual lines is out of scope too, because it requires glyph
measurement — see the wrapping example above.

## License

MIT. Bundled Unicode data is covered by the
[Unicode Terms of Use](https://www.unicode.org/terms_of_use.html); see
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

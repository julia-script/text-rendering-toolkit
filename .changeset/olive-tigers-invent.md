---
'@text-rendering-toolkit/linebreak': minor
'@text-rendering-toolkit/layout': minor
---

Replace pair-table line breaking with a rule-based UAX #14 implementation for
Unicode 17.0.0.

Line breaking previously came from `linebreak@1.1.0`, whose Unicode 13 data was
four major versions behind this project's own script data. The gap could not be
closed by regenerating tables: that dependency is pair-table based, and UAX #14
deleted its section 7, "Pair Table-Based Implementation", no later than Unicode
13.0.0 revision 45 — the very version it targets. Rules that need carried
context cannot be expressed as matrix cells, and newer Unicode versions keep
adding them: LB8a holds emoji ZWJ sequences together, LB21a needs the character
before a hyphen, LB25 matches numeric sequences of unbounded length, and LB30a
requires an even/odd count of preceding regional indicators.

The new `@text-rendering-toolkit/linebreak` package evaluates all 44 rules in
specification order against explicit carried state, with property tables
generated from vendored Unicode Character Database files. It has no runtime
dependencies and touches no font, renderer, platform, or network resource. It
passes all 19,338 cases of the official `LineBreakTest-17.0.0.txt` corpus with
none excluded, measured against a harness that scores 0.000% for an
implementation reporting nothing and 9.355% for one breaking everywhere.

`findLineBreakOpportunities()` returns ordered UTF-16 offsets with a `required`
flag. An optional `LineBreakStream` performs the same analysis over text that
arrives incrementally: it produces identical output across all 83,716 two-way
splits of the corpus, withholds any decision that needs a character which has
not arrived, and retained a peak of 5 UTF-16 units over a 108,000-unit stream.
Most implementations require the whole string up front; this one does not,
because LB25 is decided from forward-carried state rather than a backward scan.

`@text-rendering-toolkit/layout` now sources opportunities from that package
behind its existing internal adapter. The swap changed no break boundary in any
recorded fixture, and `PreparedText` schema version 2 is unchanged, so cached or
transported preparations stay valid.

Both packages are `minor` rather than `patch` because default break positions
change where Unicode 13 and Unicode 17 disagree. Callers who depend on exact
legacy boundaries will see different wrapping; the public types and schema
version do not change.

Analysis is roughly 19× slower than the pair table it replaces — 7.66 ms against
0.31 ms for 18,000 Latin characters, on verified-identical output. Shaping
dominates text layout by orders of magnitude, so this is not measurable end to
end, and the full layout suite shows no regression. The measurement and the
optimizations that were tried and rejected are recorded in
`docs/validation/unicode-17-line-breaking.md`.

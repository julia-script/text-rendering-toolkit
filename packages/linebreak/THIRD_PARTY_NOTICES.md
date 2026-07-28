# Third-party notices

`@text-rendering-toolkit/linebreak` bundles no third-party runtime code. It vendors
Unicode Character Database files as generator input and as a conformance corpus, and
its committed property tables are derived from them.

## Unicode Character Database 17.0.0

© 2025 Unicode®, Inc.

Unicode and the Unicode Logo are registered trademarks of Unicode, Inc. in the U.S.
and other countries.

Distributed under the Unicode Terms of Use:
<https://www.unicode.org/terms_of_use.html>

The following files come unmodified from `https://www.unicode.org/Public/17.0.0/`.
The property files are vendored under `data/17.0.0/`; the conformance corpus is
fetched on demand by `scripts/fetch-corpus.ts` and verified against a pinned
SHA-256 digest.

| File | Source path | Role |
| --- | --- | --- |
| `DerivedLineBreak.txt` | `ucd/extracted/DerivedLineBreak.txt` | Line_Break property, generator input |
| `DerivedEastAsianWidth.txt` | `ucd/extracted/DerivedEastAsianWidth.txt` | East_Asian_Width property, generator input |
| `DerivedGeneralCategory.txt` | `ucd/extracted/DerivedGeneralCategory.txt` | General_Category property, generator input |
| `emoji-data.txt` | `ucd/emoji/emoji-data.txt` | Emoji properties, generator input |
| `LineBreakTest.txt` | `ucd/auxiliary/LineBreakTest.txt` | Conformance corpus (fetched, not vendored) |

The committed tables under `src/` are generated from these files. They are derived
data, not a copy of the Unicode Character Database, and carry the same terms.

## Reference material

The rule structure and carried-state design are informed by a separate Zig
implementation of UAX #14 authored by this project's maintainer, which is not
distributed with or incorporated into this package. No third-party code was copied.

The algorithm itself is specified by Unicode Standard Annex #14, "Unicode Line
Breaking Algorithm": <https://www.unicode.org/reports/tr14/>

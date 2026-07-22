## 1. Dependency and opportunity adapter

- [x] 1.1 Add exact `linebreak@1.1.0` runtime metadata, a local non-exported declaration, MIT attribution, and lockfile updates to the layout package.
- [x] 1.2 Prove the published ESM entry works in Node, the clean packed consumer, and the existing browser-module fixture before coupling production preparation to it.
- [x] 1.3 Implement the internal iterator adapter with UTF-16 validation, progress checks, ordered deduplication, required-flag merging, grapheme filtering, CRLF normalization, and one terminal boundary.
- [x] 1.4 Capture the relevant Unicode 13 conformance projection, upstream exclusions, and focused punctuation, CJK, emoji, regional-indicator, combining, and mandatory-control adapter fixtures; pause for an artifact update if a required case fails.

## 2. PreparedText schema version 2

- [x] 2.1 Add the public readonly structural opportunity type, bump `PreparedText` to schema version 2, and populate deeply frozen font-neutral opportunities from `prepareText()`.
- [x] 2.2 Extend prepared-value validation for schema incompatibility, ordering, uniqueness, UTF-16 and grapheme boundaries, terminal coverage, required controls, and immutable caller input.
- [x] 2.3 Update canonical preparation fixtures, serialization round trips, one-call equivalence, structured failures, and schema-version-1 rejection without changing font selection or ownership.

## 3. Resolved layout opportunity policy

- [x] 3.1 Add optional explicit opportunities to `ResolvedLayoutInput` and validate them without importing `linebreak` or changing callers that omit the field.
- [x] 3.2 Refactor hard and soft line construction to honor required controls, explicit soft opportunities, `nowrap`, trailing whitespace, indentation, spacing, and grapheme-safe `break-word` fallback.
- [x] 3.3 Add deterministic resolved-core fixtures for explicit punctuation/CJK opportunities, mandatory controls, mixed bidi lines, malformed boundaries, no-wrap behavior, and unchanged legacy whitespace cases.

## 4. Exact raw-text line composition

- [x] 4.1 Add a provisional opportunity-aware layout pass over the existing font-selected, fully shaped segments without exposing intermediate state.
- [x] 4.2 Implement call-local fragment-shape memoization and adjacent candidate probing so each accepted soft line uses the greedy last exactly shaped opportunity that fits.
- [x] 4.3 Split compatible selected segments at final soft and required boundaries, reshape the exact substrings through the existing public font API, and perform the final resolved layout with a stable selected break plan.
- [x] 4.4 Preserve font fallback, source clusters, whole-text bidi levels, scaling, carets, selections, lazy outlines, structured failures, and caller font lifetime across provisional and final passes.
- [x] 4.5 Add public-font regressions proving CJK and punctuation wrapping, emoji/ZWJ/RI integrity, mixed-direction placement, Arabic contextual reshaping at line ends, emergency wrapping, and deterministic repeated output.
- [x] 4.6 Record bounded shaping-call and execution-time observations for long Latin and opportunity-dense CJK paragraphs without introducing a worker, persistent cache, or performance guarantee.

## 5. Packaging, documentation, and handoff

- [x] 5.1 Update the layout README, documentation application, architecture, and validation records with schema version 2, opportunity ownership, reshaping behavior, regeneration guidance, and the Unicode 13/browser-tailoring limits.
- [x] 5.2 Extend package-boundary, browser-module, isolated package-family, and local release-candidate checks to exercise Unicode-aware preparation and measured wrapping from packed public exports.
- [x] 5.3 Add a documented browser observation for representative wrapping while keeping Unicode/project fixtures normative and excluding dictionary segmentation, hyphenation, locale/CSS tailoring, and complete browser-parity claims.
- [x] 5.4 Run repository formatting, linting, type checking, unit tests, production builds, documentation build, browser evidence, strict OpenSpec validation, and local release-candidate validation.
- [x] 5.5 Update the roadmap to record the completed Unicode-opportunity slice, its remaining Unicode/tailoring gaps, and the next bounded step toward browser-grade line breaking.

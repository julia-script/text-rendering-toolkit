## 1. Vendor Unicode 17.0.0 data

- [x] 1.1 Vendor `DerivedLineBreak.txt`, `DerivedEastAsianWidth.txt`, `DerivedGeneralCategory.txt`, `DerivedCoreProperties.txt`, and `emoji-data.txt` from `unicode.org/Public/17.0.0/` under `packages/linebreak/data/17.0.0/`
- [x] 1.2 Vendor `LineBreakTest-17.0.0.txt` as the conformance corpus
- [x] 1.3 Record the Unicode data license and source URLs in the package's third-party notice

## 2. Generate property tables

- [x] 2.1 Write a TypeScript generator that parses the vendored UCD range files
- [x] 2.2 Emit committed typed-array tables for line-break class, East Asian Width, general category, and the emoji properties the rules consult
- [x] 2.3 Emit the 49-member line-break class enumeration including `HH`
- [x] 2.4 Verify the generator reproduces committed tables byte-for-byte on a second run
- [x] 2.5 Spot-check resolved classes for known Unicode 17 assignments against the vendored source

## 3. Build the conformance harness

- [x] 3.1 Parse `LineBreakTest-17.0.0.txt` into cases of code points, expected break positions, and the `÷`/`×` markers
- [x] 3.2 Report pass rate plus per-case failure detail naming code points and the rule involved
- [x] 3.3 Confirm all 19,338 cases are evaluated with none silently skipped
- [x] 3.4 Verify the harness runs red against an empty rule core, proving it discriminates

## 4. Implement the Unicode 17 rule core

- [x] 4.1 Extend the generator with `Pi`, `Pf`, `Cn`, and the `$EastAsian` definition the rules require, and regenerate
- [x] 4.2 Define the explicit carried-state object covering regional-indicator count, spacing/quotation context, numeric-sequence state, and combining-mark base
- [x] 4.3 Define the position-and-lookup interface the core consumes, independent of any concrete input driver
- [x] 4.4 Implement LB1 class resolution and LB9/LB10 combining-mark folding
- [x] 4.5 Implement the mandatory and space rules (LB2–LB8a, LB11–LB14, LB18) over UTF-16 offsets with surrogate-pair-safe iteration
- [x] 4.6 Implement the quotation rules (LB15a, LB15b, LB19, LB19a) using `Pi`/`Pf` and East Asian context
- [x] 4.7 Implement LB15c, LB15d, LB16, LB17, LB20, LB20a, LB21, LB21a, LB21b, LB22
- [x] 4.8 Implement LB23, LB23a, LB24, LB26, LB27, LB28, LB29, LB30
- [x] 4.9 Implement LB25 numeric sequences from forward-carried state with no backward scan
- [x] 4.10 Implement LB28a Brahmic orthographic syllables including the dotted-circle class
- [x] 4.11 Implement LB30a regional-indicator pairing and LB30b emoji-modifier rules
- [x] 4.12 Implement LB31 as the default break

## 5. Reach Unicode 17 conformance

- [x] 5.1 Work the corpus down in rule-attribution order until the pass rate stops improving
- [x] 5.2 Triage remaining corpus failures and attribute each to a rule
- [x] 5.3 Record the final pass rate and a rationale for every case that does not pass
- [x] 5.4 Confirm no reverse iteration over analyzed text remains in the source
- [x] 5.5 Confirm no class-by-class break matrix is consulted in the source

## 6. Public batch surface

- [x] 6.1 Expose an analysis entry point returning ordered unique UTF-16 offsets with a required flag
- [x] 6.2 Validate offsets are in range, unique, ordered, and never inside a surrogate pair
- [x] 6.3 Confirm mandatory breaks including CRLF are reported exactly once
- [x] 6.4 Confirm the package is pure, synchronous, and free of font, layout, renderer, platform, and network access
- [x] 6.5 Add the package README documenting Unicode 17.0.0, the pass rate, and excluded scope

## 7. Evaluate the streaming driver

- [x] 7.1 Implement a streaming driver over the shared rule core
- [x] 7.2 Differential-test every corpus case split at every possible boundary against batch output
- [x] 7.3 Verify a decision needing an unavailable character is withheld rather than decided from absent input
- [x] 7.4 Verify retained text is trimmed to what the pending decision requires
- [x] 7.5 Benchmark streaming against batch on identical input and record the comparison
- [x] 7.6 Decide ship-or-drop from the measurement and record the rationale

## 8. Swap the adapter in layout

- [x] 8.1 Point `packages/layout/src/internal/line-break.ts` at the new package
- [x] 8.2 Run existing layout fixtures and enumerate every changed break boundary
- [x] 8.3 Review each changed boundary as an intended Unicode 17 difference, or fix it
- [x] 8.4 Confirm `PreparedText` schema version and structure are unchanged
- [x] 8.5 Re-record preparation fixtures via the existing `fixtures:record` script
- [x] 8.6 Confirm the full workspace test suite, typecheck, and build pass

## 9. Remove the dependency

- [x] 9.1 Remove `linebreak@1.1.0` from `packages/layout/package.json` and the lockfile
- [x] 9.2 Remove its local type declaration and third-party notice entry
- [x] 9.3 Confirm no source or lockfile reference to the dependency remains
- [x] 9.4 Verify clean-package ESM and browser consumption of the new dependency graph

## 10. Update evidence and documentation

- [x] 10.1 Add a conformance record under `docs/validation/` with the pass rate and failing-case rationale
- [x] 10.2 Update `docs/validation/unicode-line-breaking.md` with post-swap composition observations
- [x] 10.3 Update `packages/layout/README.md` to name the new implementation and Unicode 17.0.0
- [x] 10.4 Update `ARCHITECTURE.md` to reflect the replaced algorithm
- [x] 10.5 Update the `ROADMAP.md` browser-grade line-breaking card and add a changelog entry

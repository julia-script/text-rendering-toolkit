## 1. Establish production contracts and dependencies

- [x] 1.1 Add exact `bidi-js@1.0.3` and `unicode-script@1.2.0` layout-package dependencies, narrow internal TypeScript declarations, and complete third-party/Unicode notices that survive package packing.
- [x] 1.2 Define and export readonly raw-input, style, layout-policy, prepared-segment, prepared-text, registry, and structured preparation-error contracts without changing existing resolved-layout types.
- [x] 1.3 Add internal validation and deep-freeze utilities for UTF-16 ranges, finite normalized policy/style values, schema-versioned parsed prepared values, and deterministic error metadata.

## 2. Implement font-independent preparation

- [x] 2.1 Implement grapheme segmentation, Unicode-scalar validation, paragraph-direction normalization, and whole-text `bidi-js` analysis with preserved UTF-16 source identity.
- [x] 2.2 Implement Unicode Script/Script_Extensions lookup, Common/Inherited adoption, style-range intersection, hard-break handling, and compatible segment coalescing according to the accepted policy.
- [x] 2.3 Implement `prepareText()` as a deterministic, deeply immutable, JSON-serializable operation and revalidate parsed prepared values at the font-aware boundary without exposing dependency-specific objects or speculative paragraph metadata.

## 3. Implement explicit-font resolution and layout composition

- [x] 3.1 Implement ordered caller-registry validation and grapheme-safe fallback with documented combining/default-ignorable coverage policy, adjacent selection coalescing, and structured missing-key/coverage failures.
- [x] 3.2 Shape selected segments once through public `FontHandle` operations, apply language/features/variations, scale metrics and glyph measurements exactly once, preserve `fontUnitScale`, and keep glyph bounds lazy without calling `getOutline()`.
- [x] 3.3 Implement `layoutPreparedText()` to produce the existing `LayoutResult` through unchanged `layoutResolvedText()`, including empty and multiple-hard-paragraph inputs without making new behavior depend on the legacy top-level paragraph level.
- [x] 3.4 Implement `layoutText()` as exact one-call composition, export all three operations, and preserve existing `layoutResolvedText()` and selection-helper behavior.

## 4. Promote validation evidence into package conformance

- [x] 4.1 Port all canonical preparation fixtures into production-package tests for Latin, Arabic, Devanagari, Khmer, mixed bidi, Common/Inherited adoption, controls, grapheme boundaries, styles, variations, hard breaks, empty text, fallback, and deterministic failures without importing experiment source.
- [x] 4.2 Add repeatability, parsed-serialization reuse, deep-immutability, input/handle ownership, one-call equivalence, no-outline-access, and structured-error tests.
- [x] 4.3 Re-run every existing resolved-layout synthetic/public-font fixture unchanged and add public-font composition checks for glyphs, lines, bounds, carets, selections, and reusable structurally equivalent registries.
- [x] 4.4 Validate packed font/layout packages in a clean strict-TypeScript ESM consumer and a browser-compatible ESM build, including runtime dependency, declaration, export, and notice resolution without network or workspace-only imports.

## 5. Document and verify the production boundary

- [x] 5.1 Update the layout README with two-stage, one-call, expert-path, lazy-outline, caller-owned-font, Unicode-version, error, and limitation examples; update architecture and roadmap status without adding renderer or font-fetching responsibilities.
- [x] 5.2 Run canonical fixture regeneration checks, formatting, type checks, package/workspace tests, builds, clean-package validation, browser-compatible validation, dependency-direction checks, and strict OpenSpec validation from a clean install.

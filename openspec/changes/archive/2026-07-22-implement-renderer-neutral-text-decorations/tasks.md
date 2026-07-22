## 1. Font Decoration Metrics

- [x] 1.1 Extract the existing bounded SFNT table-directory and bounds helpers into a private font utility shared by color and decoration readers without changing public table access.
- [x] 1.2 Add immutable public `FontDecorationMetrics` facts and read valid `post` underline plus OS/2 strikeout values from the handle-owned bytes.
- [x] 1.3 Define and document deterministic absent/non-positive metric fallbacks, reject truncated present tables through `InvalidFontError`, and preserve cleanup on failed loads.
- [x] 1.4 Add representative TTF, CFF/OpenType, variable, COLR v0, fallback, malformed-table, stable-facts, disposal, and packed-consumer font tests.

## 2. Layout Metric Handoff

- [x] 2.1 Extend resolved run/default metrics with the four required scaled decoration values and validate finite positions plus positive finite thicknesses.
- [x] 2.2 Scale public font decoration facts once in `layoutPreparedText()` and `layoutText()` without adding decoration state to `TextStyle` or `PreparedText`.
- [x] 2.3 Retain immutable half-open decoration metric ranges in `LayoutResult`, including mixed fonts/sizes and the minimum default context, without retaining fonts or outlines.
- [x] 2.4 Update resolved, prepared, fixture, serialization, and public-font tests to prove metric coordinates and unchanged glyph, line, caret, selection, and preparation identities.

## 3. Public Decoration Contract

- [x] 3.1 Add and export immutable decoration span, color, kind/style, skip-ink, analytic segment, derivation option, result, and bounds types using the existing renderer-neutral RGBA/foreground convention.
- [x] 3.2 Implement all-input validation for half-open UTF-16/grapheme-safe ranges, supported kind/style combinations, RGBA bytes, finite offsets, positive thicknesses, and optional clipping.
- [x] 3.3 Implement pure wrapped, hard-broken, trailing-space, adjacent-range, and bidi-aware visual fragmentation over existing layout/caret data without reshaping or mutating `LayoutResult`.
- [x] 3.4 Resolve automatic metrics from retained source-range context once per decoration span and apply numeric thickness/offset overrides directly in layout units.
- [x] 3.5 Resolve solid, dotted, and wavy underline plus solid strikethrough into deterministic analytic dimensions with phase zero per new visual fragment.
- [x] 3.6 Apply horizontal clipping and bounds-only automatic skip ink with thickness-derived clearance, preserved phase, missing-bounds fallback, and no outline access.
- [x] 3.7 Return immutable segments in deterministic order with aggregate decoration bounds and export the single pure derivation operation from the packed layout package.

## 4. Production Conformance

- [x] 4.1 Promote the accepted private cases into public-package fixtures covering partial/adjacent ranges, spaces, empty and wrapped lines, Latin descenders, combining marks, Arabic, mixed bidi, mixed fonts/sizes, numeric overrides, clipping, and COLR v0 coexistence.
- [x] 4.2 Add focused tests for all styles, independent RGBA/current foreground, automatic metrics, fallback stability, phase continuity, skip-ink modes, immutability, invalid input, and repeatability.
- [x] 4.3 Prove a minimal non-Three typed-array, SVG, or Canvas consumer can reproduce the analytic segments without font handles, shaping, SDF, atlas, DOM-at-module-load, or Three dependencies.
- [x] 4.4 Extend packed clean-consumer and browser ESM checks so only public font/layout exports are used and no private experiment becomes a production dependency.

## 5. Documentation and Project State

- [x] 5.1 Document font decoration facts, resolved expert metrics, the post-layout derivation API, supported style/color semantics, pattern phase, clipping, bounds-only skip ink, and the explicit MVAR/outline-aware limitations.
- [x] 5.2 Extend the existing multilingual layout inspector with an interactive non-Three decoration view for solid/dotted/wavy underline, strikethrough, independent color, numeric/automatic metrics, and skip-ink toggles while preserving current inspector behavior.
- [x] 5.3 Update `ARCHITECTURE.md`, `ROADMAP.md`, validation references, and documentation-app repository mirrors to record the shipped renderer-neutral boundary while leaving Three outline/shadow as the independent next change.

## 6. Verification

- [x] 6.1 Run focused font/layout tests, deterministic fixture regeneration, packed and browser-neutral consumers, workspace format/typecheck/test/build, and documentation build checks and resolve all failures.
- [x] 6.2 Confirm `@webgpu-text/sdf` and `@webgpu-text/three` public manifests and exports remain unchanged, validate the OpenSpec change strictly, and record the completed task state.

## 7. Browser-Parity Correction

- [x] 7.1 Resolve automatic position and thickness once from the first effective metric range of each decoration span so fallback emoji and script fonts cannot introduce vertical steps.
- [x] 7.2 Add regression coverage for continuous mixed-font decorations and let the SVG inspector refine automatic skip ink with its already-owned outlines while keeping layout outline-free.
- [x] 7.3 Update documentation and rerun focused, docs, workspace, deterministic-fixture, packed-consumer, and strict OpenSpec gates.

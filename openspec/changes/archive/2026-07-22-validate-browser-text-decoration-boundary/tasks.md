## 1. Validation Workspace and Inventory

- [x] 1.1 Add the private strict-TypeScript ESM decoration-boundary experiment, workspace scripts, typed fixture schema, and deterministic observation outputs without changing public package exports.
- [x] 1.2 Record the current layout range/line/caret data, available font metrics, SDF encoding and padding, Three material controls, shared-resource keys, bounds, clipping, COLR composition, and lifecycle behavior that constrain the candidates.

## 2. Representative Decoration Corpus

- [x] 2.1 Define attributed deterministic cases for solid, dotted, and wavy underline plus solid strikethrough with explicit independent colors and current-foreground updates.
- [x] 2.2 Cover partial and adjacent UTF-16 ranges, spaces, trailing spaces, empty lines, hard and soft wrapping, Latin descenders, combining marks, Arabic, mixed bidi, mixed fonts, mixed sizes, and COLR v0 emoji.
- [x] 2.3 Record automatic and numeric metric expectations, pattern phase and clipping cases, skip-ink comparison inputs, and unchanged glyph/line/caret/selection identities.

## 3. Renderer-Neutral Decoration Candidates

- [x] 3.1 Implement private logical-range fragmentation candidates that produce explicit visual intervals across wrapping and bidi placement without reshaping or mutating `LayoutResult`.
- [x] 3.2 Implement private immutable analytic segment candidates for solid, dotted, and wavy patterns with independent RGBA/current-foreground color, thickness, offset, phase, and fragment clipping.
- [x] 3.3 Compare compact retained layout metrics, caller-font metric resolution, and explicit overrides for automatic underline and strikethrough placement.
- [x] 3.4 Compare bounds-only, outline-aware, and no-skip underline policies, recording fidelity, lazy-outline work, and the minimum backend-neutral cutout representation.
- [x] 3.5 Prove a minimal non-Three consumer can reproduce accepted decoration segments without shaping, bidi, font-selection, atlas, or Three.js dependencies.

## 4. Shared-SDF Glyph Paint Candidates

- [x] 4.1 Implement the minimum private Three candidates for fill plus stroke/outline and one offset or softened drop shadow while reusing existing SDF pixels and stable shared atlas slots.
- [x] 4.2 Measure outline width and shadow softness across representative fonts, glyphs, text sizes, and SDF sizes, including distance precision, antialiasing, padded geometry, bounds expansion, and clipping limits.
- [x] 4.3 Validate that appearance color and supported paint controls do not duplicate outline lookup, SDF generation, or atlas resources, and define explicit rejection, clamping, or larger-resource behavior beyond accepted limits.
- [x] 4.4 Record ordinary and COLR v0 composition semantics, atomic update and recovery behavior, shared borrower stability, and repeated disposal ownership.

## 5. Actual WebGPU Evidence

- [x] 5.1 Extend the private WebGPU harness with representative unlit and applicable planar-lit decoration and glyph-paint scenes using the pinned Three renderer.
- [x] 5.2 Record semantic pixel observations for solid, dotted, and wavy underline, independent glyph/decoration colors, current foreground, multilingual fragmentation, transparency, placement, and clipping.
- [x] 5.3 Record semantic and resource observations for accepted outline and shadow ranges, expanded bounds, SDF/atlas reuse, COLR behavior, failed-update recovery, and cleanup.

## 6. Decision and Project Documentation

- [x] 6.1 Write machine-readable observations and a human-readable validation report selecting the neutral segment contract, metric source, pattern phase, skip-ink policy, shared-SDF limits, COLR semantics, package ownership, rejected alternatives, and narrow TypeScript contract sketches.
- [x] 6.2 Scope independent production follow-ups for renderer-neutral line decoration and Three glyph paint, including solid/dotted/wavy underline and independent decoration-color acceptance criteria.
- [x] 6.3 Update `ARCHITECTURE.md`, `ROADMAP.md`, and their documentation-app mirrors through the repository's existing synchronization path using only recorded decisions.

## 7. Verification

- [x] 7.1 Run focused experiment tests, deterministic observation regeneration, actual-WebGPU evidence, workspace typecheck, test, format, build, and documentation checks and resolve all failures.
- [x] 7.2 Validate the completed OpenSpec change strictly and confirm production package manifests and exports remain unchanged by the private spike.

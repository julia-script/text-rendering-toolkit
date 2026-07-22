## 1. Public font color-layer boundary

- [x] 1.1 Add and export the immutable RGBA, current-foreground, color-layer result, and `FontHandle.getColorLayers()` TypeScript contracts without exposing COLR/CPAL table structures.
- [x] 1.2 Retain the already-owned exact font-byte copy inside each live handle, release that reference and color cache on disposal, and preserve all existing native ownership behavior.
- [x] 1.3 Implement a package-private bounded SFNT/COLR v0/CPAL palette-zero reader with complete offset, count, version, layer-range, palette-index, and RGBA validation.
- [x] 1.4 Integrate lazy per-glyph color-layer lookup and immutable hit/miss caching into the production font handle, returning `null` for ordinary, absent, and unsupported color formats.
- [x] 1.5 Add public-entry font tests for ordered layers, palette colors, current foreground, accepted emoji sequences, ordinary and COLR v1 fallback, malformed v0 data, repeated lookup, source-byte ownership, and disposed-handle rejection.
- [x] 1.6 Extend the font package packed-consumer check and public documentation so a clean ESM consumer can shape a COLR v0 glyph, resolve its layers, retrieve their numeric outlines, and dispose the handle.

## 2. Three renderer layer composition

- [x] 2.1 Extend the optional structural `TextFont` boundary with the minimal color-layer result while preserving outline-only custom handles and avoiding a runtime font-package dependency.
- [x] 2.2 Expand color glyphs only inside renderer resource planning into ordered layer-outline work that retains base placement, scale, variations, style, and the original committed `LayoutResult`.
- [x] 2.3 Reuse the existing font-object/layer-glyph/variation/SDF-size atlas identity so repeated and shared color layers reuse ordinary SDF slots without color-specific pixel duplication.
- [x] 2.4 Promote private glyph instance color storage and TSL inputs from RGB to RGBA, multiply CPAL alpha into clipped text opacity, and prevent fully transparent layers from contributing visible or shadow coverage.
- [x] 2.5 Resolve the current-foreground marker from each base glyph's effective per-style or default color and update instance RGBA without repeating outline extraction or SDF generation.
- [x] 2.6 Preserve ordinary outline fallback for absent/unsupported color payloads and retain existing private/shared resource, atlas growth, material, clipping, lighting, shadow, and disposal behavior.
- [x] 2.7 Keep color lookup, layer SDF planning, RGBA assembly, and resource changes inside the existing atomic synchronization boundary with last-good-state recovery after malformed or failing layers.
- [x] 2.8 Add deterministic renderer tests for layer order, base placement, unchanged layout identity, CPAL/current-foreground/alpha, fallback, rapid updates, malformed failure recovery, repeated/shared reuse, distinct font objects, atlas growth, and idempotent disposal.

## 3. Public integration and actual-WebGPU evidence

- [x] 3.1 Add a public font-layout-Three integration covering the accepted single-code-point, modifier, flag, and ZWJ corpus plus mixed styled monochrome/color text at two sizes.
- [x] 3.2 Prove that preparation, layout measurement, line data, carets, selections, and explicit caller font ordering remain unchanged and require no color payloads.
- [x] 3.3 Extend actual-WebGPU browser evidence for unlit and planar-lit mixed text with intrinsic colors, current foreground, CPAL alpha, transparent exterior, correct placement/order, shared reuse, update recovery, and lifecycle observations.
- [x] 3.4 Extend the clean packed release-candidate consumer to install and exercise the public font, layout, SDF, and Three color path without workspace links, experiment imports, unpublished modules, WebGL, or CommonJS.

## 4. Documentation and reconciliation

- [x] 4.1 Update font and Three package documentation and the docs app with a caller-owned-byte COLR v0 example, explicit font-order guidance, palette-zero/current-foreground behavior, and ordinary fallback.
- [x] 4.2 Update provenance notices for the accepted attributed color fixtures and verify no experiment implementation or new runtime dependency enters a production package.
- [x] 4.3 Update `ARCHITECTURE.md` and `ROADMAP.md` only after validation passes, marking COLR v0 shipped while keeping COLR v1, embedded bitmap, SVG, automatic emoji preference, and universal color payloads deferred.

## 5. Verification

- [x] 5.1 Run focused font and Three tests, type checking, formatting, package builds, declaration/content audits, and the clean release-candidate check.
- [x] 5.2 Run browser ESM and actual-WebGPU semantic checks on the pinned Three revision, recording any environment-dependent command separately from deterministic unit evidence.
- [x] 5.3 Run the full workspace check and strict OpenSpec validation, then confirm every requirement and scenario has executable or attributed evidence before synchronization and archive.

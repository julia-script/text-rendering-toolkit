## Why

The renderer-neutral pipeline can position and select multilingual text, but editors and browser-like consumers still have to invent their own underline and strikethrough semantics. The completed decoration-boundary validation now provides enough evidence to ship the layout-owned half first without coupling it to Three, SDFs, or eager outlines.

## What Changes

- Add compact underline and strikethrough metrics to public font facts using bounded existing font-byte access, with deterministic fallbacks for absent optional tables.
- Add independent half-open UTF-16 decoration spans and a pure post-layout operation that returns immutable analytic visual segments.
- Support solid, dotted, and wavy underline plus solid strikethrough, explicit RGBA or current-foreground color, automatic or numeric thickness/offset, deterministic per-fragment phase, clipping, and optional bounds-only skip ink.
- Retain the minimum scaled metric context in `LayoutResult` so decoration-only changes reuse preparation, shaping, line layout, carets, and selections.
- Resolve automatic placement once per decoration span so fallback fonts such as color emoji cannot introduce vertical steps inside one continuous decoration.
- Document and test a minimal non-Three consumer while leaving tessellation and drawing to each renderer.
- Keep glyph outline, drop shadow, COLR composed-silhouette paint, layout-owned outline-aware skip ink, and interaction behavior outside this change; renderers that already own outlines or SDFs may refine the retained automatic skip-ink policy.

## Capabilities

### New Capabilities

- `renderer-neutral-text-decorations`: Defines independent decoration spans, immutable analytic segments, metric resolution, phase, clipping, skip-ink, bounds, and non-Three consumption.

### Modified Capabilities

- `font-engine-core`: Extend normalized font facts with bounded renderer-neutral underline and strikethrough metrics.
- `text-layout-core`: Retain scaled decoration metric context and expose pure post-layout decoration derivation without changing preparation identity.

## Impact

- Public TypeScript contracts and exports in `@webgpu-text/font` and `@webgpu-text/layout`.
- Bounded internal SFNT metric reading in the font package, reusing the existing owned-byte and validation boundary without a new dependency.
- Layout result assembly, validation, fixtures, packed-package checks, and direct-consumer documentation.
- No dependency or API changes in `@webgpu-text/sdf` or `@webgpu-text/three`; the private validation experiment remains evidence only.

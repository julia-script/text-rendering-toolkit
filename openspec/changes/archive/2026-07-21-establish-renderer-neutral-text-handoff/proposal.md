## Why

`@webgpu-text/three` currently accepts resolved shaped input, executes text layout, recovers font scaling from the original runs, and derives selections. That leaves text-processing policy inside a renderer adapter and prevents `LayoutResult` from serving as the complete reusable handoff to future Canvas, SVG, WebGPU, or other renderers.

## What Changes

- Extend the resolved layout contract so each positioned glyph carries the renderer-neutral scale needed to transform its font-unit outline into layout units.
- **BREAKING** Require resolved shaped runs to provide that font-unit scale and preserve it in `LayoutResult`.
- **BREAKING** Change `@webgpu-text/three` `Text` construction and updates to accept a completed `LayoutResult` rather than `ResolvedLayoutInput`.
- Remove layout execution and selection derivation from the Three package; consumers use `layoutResolvedText()` and `getSelectionRects()` directly from `@webgpu-text/layout`.
- Narrow the renderer's structural font dependency to lazy outline lookup; font facts and text-layout policy no longer participate in rendering.
- Update package examples, tests, validation evidence, and architecture documentation to demonstrate one prepared layout reused independently of Three-specific state.
- Keep raw-string preparation, automatic itemization/fallback, lighting, and additional renderer implementations outside this change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `text-layout-core`: Make `LayoutResult` a sufficient renderer-neutral glyph-placement handoff by preserving the font-unit-to-layout-unit scale on each positioned glyph.
- `three-webgpu-text-core`: Make the Three adapter consume completed layout data and remove its ownership of layout and selection computation.

## Impact

- Public breaking changes to `ResolvedShapedRun`, `PositionedGlyph`, `TextOptions`, and mutable `Text` state.
- `packages/layout` fixtures, validation, public-font translation examples, and package declarations must include the new scale contract.
- `packages/three` no longer invokes `layoutResolvedText()` or `getSelectionRects()`, and its font interface no longer requires `facts.unitsPerEm`.
- The public Three example and actual-WebGPU fixture must prepare layout before constructing or updating `Text`.
- `ARCHITECTURE.md` and `ROADMAP.md` must describe `LayoutResult` as the renderer boundary while preserving caller ownership of font handles and renderer-owned atlas/GPU resources.

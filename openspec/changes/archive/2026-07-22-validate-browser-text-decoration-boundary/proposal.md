## Why

The renderer can place and paint glyphs, but common editor and browser text decorations still require application-specific geometry and materials. Before exposing a production API, the project needs to prove where decoration geometry belongs and whether the existing SDF resources can support useful underline, outline, and shadow paint without harming text quality.

## What Changes

- Add a private strict-TypeScript, ESM-only validation slice for browser-like text decoration and paint.
- Validate solid, dotted, and wavy underlines, including an underline color independent of glyph fill, across styled ranges, wrapping, mixed fonts, and bidirectional text.
- Compare renderer-neutral underline and strikethrough segments derived from layout data with renderer-owned SDF stroke/outline and drop-shadow controls.
- Measure font-metric placement, line-fragment clipping, skip-ink behavior, SDF padding, outline thickness, shadow offset/softness, atlas reuse, and bounds expansion.
- Prove the selected seams using deterministic fixtures and a minimal actual-WebGPU observation through the existing Three renderer.
- Produce a decision record and narrow public-contract sketch for follow-up production changes.
- Update the roadmap and architecture only from recorded evidence; do not add public decoration APIs in this validation change.

## Capabilities

### New Capabilities

- `browser-text-decoration-boundary-validation`: Defines the evidence and decisions required to separate renderer-neutral line decorations from renderer-specific SDF stroke and shadow paint, including editor-oriented underline styles and independent decoration color.

### Modified Capabilities

None.

## Impact

- Adds a private validation experiment, deterministic fixture data, actual-WebGPU observations, and a durable decision report.
- Exercises the public layout, font, SDF, and Three packages without changing their production contracts.
- May identify later changes to layout result data, text style metadata, renderer appearance controls, render bounds, or SDF resource settings; those changes remain follow-up work.
- Does not implement arbitrary shader rewriting, interaction behavior, font fetching, WebGL support, or a general rich-text document model.

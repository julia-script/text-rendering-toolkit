# Three WebGPU text core validation

Status: **passing on the recorded Three.js and Chromium revisions**

Validated: 2026-07-22

Change: `implement-three-webgpu-text-core`

Renderer-neutral handoff revalidated by:
`establish-renderer-neutral-text-handoff`

Planar lighting and shadows integrated by:
`integrate-planar-lit-text`

Shared renderer resources integrated by:
`establish-shared-text-renderer-resources`

Ordinary-glyph SDF outline and visual shadow integrated by:
`implement-three-sdf-outline-shadow`

## Result

The production `@webgpu-text/three` public API renders completed
renderer-neutral `LayoutResult` data for real-font Latin and Arabic text through
Three.js 0.185.1 on an actual Apple Metal-backed WebGPU adapter. Text shaping and
layout execute before the Three adapter receives the result. The fixture
exercised 14 initial and 15 updated glyph instances, multiple RGBA atlas cells,
lazy font outlines, CPU SDF generation, style colors, clipping, direct
layout-package selection data, and repeated disposal. Two independently
positioned text objects shared one explicit `TextResources`: the duplicate text
added no outline calls, a later borrower grew the atlas through slot 43, and the
already-rendered owner changed 0 semantic pixels without resynchronization. Its construction-fixed
planar standard material also responded to scene light, cast a glyph-shaped
shadow with a transparent `O` cutout, received an external shadow on visible
glyph coverage, preserved unaffected pixels after a synchronized update, and
used only public TSL/node-material hooks.

The same production fixture now renders independent-color fill, one outer
outline, and one offset SDF-softened visual shadow on real Latin and Arabic in
both shared material variants. Appearance mutation changed 8,456 pixels while
preserving atlas slots, outline-call count, material identity, and its TSL color
node. Directional renderer bounds expanded from the accepted paint. An
excessive outline rejected with a `sdfPadding` diagnostic and changed 0 pixels;
a later supported update recovered on the same object and resources. The
64-texel resources reserve `0.5em` physical padding, demonstrating that
resolution and paint room are independent settings. The companion actual-WebGPU
COLR fixture confirms ordinary instances remain effect-eligible while layered
color instances remain unchanged.

![Updated production renderer fixture](../../experiments/webgpu-rendering-seam/artifacts/three-webgpu-text-core.png)

The final lit-and-shadowed frame SHA-256 is
`b18a2f7f0e0e65eb228aa168105ad548e29a537503a193a9f03d1076d1d13de8`.
Machine-readable environment and semantic counts are in
[`three-webgpu-text-core.json`](../../experiments/webgpu-rendering-seam/artifacts/three-webgpu-text-core.json).

## Reproduction

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm --dir experiments/webgpu-rendering-seam browser:install
pnpm --dir experiments/webgpu-rendering-seam test:browser
```

The browser suite requires `navigator.gpu`, a usable adapter, and Three's pinned
WebGPU backend diagnostic. Missing WebGPU and WebGL fallback are failures, not
passing evidence.

## Recorded environment

| Component | Value |
|---|---|
| Three.js | `0.185.1` |
| Browser | Chrome for Testing `149.0.0.0` user agent |
| Adapter | vendor `apple`, architecture `metal-3` |
| Canvas | 512 × 256, DPR 1 |
| Initial semantic pixels | 15,229 occupied; 43,466 background-through-quad; 829 antialiased edge; 3,752 cyan fill; 1,631 green shadow; 3,588 pink outline; 703 yellow fill |
| Appearance update | 8,456 changed pixels; stable slots/material/color node; 0 additional outline calls |
| Excessive paint / recovery | 0 changed pixels after rejection; 8,456 after recovery |
| SDF resources | 64 texels; `0.5em` padding |
| Bounds before paint update | min `(-1.7241, -0.3000)`; max `(1.0271, 0.4913)` |
| Bounds after paint update | min `(-1.7581, -0.3130)`; max `(1.0191, 0.5013)` |
| Lighting gain | 105.34 luminance |
| Cast shadow / cutout | 35.96 / 0 luminance loss |
| Received / unshadowed glyph | 105.34 / 0 luminance loss |
| Instances | 14 initial; 15 after update |
| Shared cache reuse | 14 outline calls after first text; 14 after duplicate text |
| Borrower atlas growth | 36 instances; maximum slot 43; 44 total outline calls |
| Existing owner after growth | 0 changed semantic pixels without resynchronization |
| Fonts | Noto Sans variable TTF; Noto Sans Arabic variable TTF |

## Limits

This proves the layout-result renderer with private convenience resources or
an explicitly shared `TextResources`, its default unlit material, its opt-in
front-facing planar standard material, and ordinary-glyph outline plus one
visual shadow. The Three package
receives positioned glyphs and per-glyph font-unit scales, resolves outlines
lazily, and performs no shaping, line layout, caret, or selection policy. It
does not provide a Gaussian blur or shadow stack, composed-silhouette effects
for COLR layers, batching or draw-call reduction, atlas eviction, partial
texture upload, workers, frame-rate improvement, curvature, double-sided or
curved lighting, configurable physical-material controls, WebGPU compute SDF
generation, or WebGL support. Actual COLR rendering and its ordinary-only paint
boundary are recorded separately in the
[color-glyph report](color-glyph-boundary.md).

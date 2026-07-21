# Three WebGPU text core validation

Status: **passing on the recorded Three.js and Chromium revisions**

Validated: 2026-07-21

Change: `implement-three-webgpu-text-core`

## Result

The production `@webgpu-text/three` public API renders resolved real-font Latin
and Arabic text through Three.js 0.185.1 on an actual Apple Metal-backed WebGPU
adapter. The fixture exercised 12 initial and 13 updated glyph instances,
multiple RGBA atlas cells, lazy font outlines, CPU SDF generation, style colors,
opacity, clipping, stable unaffected pixels after atlas growth, committed
selection data, and repeated disposal.

![Updated production renderer fixture](../../experiments/webgpu-rendering-seam/artifacts/three-webgpu-text-core.png)

The final frame SHA-256 is
`22193ac9f2654c30e49299491e0acc067d15ceafb6652bdc9653fc8e7eca5b06`. Machine-readable environment and semantic counts are
in
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
| Initial semantic pixels | 2,923 occupied; 2,155 cyan; 752 yellow |
| Instances | 12 initial; 13 after update |
| Fonts | Noto Sans variable TTF; Noto Sans Arabic variable TTF |

## Limits

This proves the resolved-input, per-object-atlas, flat unlit renderer. It does
not prove automatic itemization/fallback, workers, shared atlas residency,
eviction, partial texture upload, curvature, lighting, shadows, batching,
WebGPU compute SDF generation, or WebGL support.

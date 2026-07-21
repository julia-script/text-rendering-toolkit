# `@webgpu-text/three`

Resolved text rendering for Three.js `WebGPURenderer`, using an instanced TSL
material and a private RGBA SDF atlas.

## Boundary

The first public API deliberately starts after application-owned font
acquisition, itemization, font selection, shaping, and layout. Pass a completed
renderer-neutral `LayoutResult` and a map of caller-owned `FontHandle` values:

```ts
import { loadFont } from '@webgpu-text/font'
import { getSelectionRects, layoutResolvedText } from '@webgpu-text/layout'
import { Text } from '@webgpu-text/three'

const response = await fetch('/fonts/NotoSans-Regular.ttf')
const font = await loadFont(await response.arrayBuffer())
const input = createResolvedInput(font, 'Hello')
const layout = layoutResolvedText(input)

const text = new Text({
  layout,
  fonts: new Map([['body', font]]),
  lit: true,
  color: 0xffffff,
  styleColors: { emphasis: 0xffcc33 },
  opacity: 1,
  clipRect: null,
})

await text.sync()
text.castShadow = true
text.receiveShadow = true
scene.add(text)
```

`createResolvedInput` and `layoutResolvedText()` are text preparation, not hidden
renderer helpers. The input builder shapes explicit directional/script runs,
scales metrics and glyph values into layout units, supplies `fontUnitScale`, and
assigns stable `fontKey` and `styleKey` values. The resulting `LayoutResult` can
also be consumed by Canvas, SVG, another GPU renderer, measurement code, or
interaction tools. See
[`examples/three-webgpu-basic`](../../examples/three-webgpu-basic/) for a complete
single-run implementation.

Omit `lit` or set it to `false` for the default unlit material. `lit: true`
selects one front-facing planar `MeshStandardNodeMaterial` with fixed
non-metallic settings and glyph-shaped shadow coverage. That choice is fixed at
construction; layout and appearance updates reuse the same material. Enable
shadow maps and configure lights at the scene level, then use the ordinary
Three.js `castShadow` and `receiveShadow` mesh flags as needed.

## Updates and interaction

Properties are mutable; call and await `sync()` after changing them:

```ts
text.layout = layoutResolvedText(nextResolvedInput)
text.styleColors = { emphasis: 0x66ff88 }
text.opacity = 0.8
await text.sync()

const committedLayout = text.layoutResult
const selection = committedLayout
  ? getSelectionRects(committedLayout, { start: 0, end: 5 })
  : []
```

Calls queued in the same microtask share one promise and commit only the newest
captured state. A failed update rejects without replacing the last successfully
rendered state. `layoutResult` is `null` before the first successful sync and is
the exact renderer-neutral result committed by that sync. Selection and other
interaction policy remain direct `@webgpu-text/layout` operations.

## Ownership

Each `Text` owns its instanced geometry, selected node material, glyph cache,
RGBA atlas bytes, and `DataTexture`. Dispose those resources with:

```ts
scene.remove(text)
text.dispose()
```

The application continues to own and dispose font handles, the shared
`WebGPURenderer`, canvas, scene, and camera. `Text.dispose()` is idempotent and
does not touch those resources.

## Supported now

- completed multilingual `LayoutResult` data from `@webgpu-text/layout`;
- lazy numeric outlines from structurally compatible public font handles;
- deterministic CPU SDF generation and per-object RGBA atlas growth;
- flat unlit fill by default or construction-fixed planar standard lighting;
- glyph-shaped cast and received shadows through ordinary Three.js mesh flags;
- per-style colors, opacity, and local rectangular clipping;
- promise-based updates, committed layout identity, and disposal; and
- Three.js `0.185.1` `WebGPURenderer` through TSL.

Not included: font fetching, automatic itemization or fallback, workers, shared
atlases, eviction, partial texture upload, curvature, strokes/outlines, runtime
material switching, configurable physical-material controls, curved or
double-sided lighting, batching, WebGPU compute SDF generation, WebGL, CommonJS,
UMD, or Troika API compatibility.

## Validation

```sh
pnpm --filter @webgpu-text/three test
pnpm --dir experiments/webgpu-rendering-seam test:browser
```

The browser command requires an actual WebGPU adapter and rejects Three's WebGL
fallback. See
[`docs/validation/three-webgpu-text-core.md`](../../docs/validation/three-webgpu-text-core.md).

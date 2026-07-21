# `@webgpu-text/three`

Resolved text rendering for Three.js `WebGPURenderer`, using an instanced TSL
material and a private RGBA SDF atlas.

## Boundary

The first public API deliberately starts after application-owned font
acquisition, itemization, font selection, and shaping. Pass a fully resolved
`ResolvedLayoutInput` and a map of caller-owned `FontHandle` values:

```ts
import { loadFont } from '@webgpu-text/font'
import type { ResolvedLayoutInput } from '@webgpu-text/layout'
import { Text } from '@webgpu-text/three'

const response = await fetch('/fonts/NotoSans-Regular.ttf')
const font = await loadFont(await response.arrayBuffer())
const input: ResolvedLayoutInput = createResolvedInput(font, 'Hello')

const text = new Text({
  input,
  fonts: new Map([['body', font]]),
  color: 0xffffff,
  styleColors: { emphasis: 0xffcc33 },
  opacity: 1,
  clipRect: null,
})

await text.sync()
scene.add(text)
```

`createResolvedInput` above is application policy, not a hidden renderer helper.
It shapes explicit directional/script runs through `FontHandle.shape()`, scales
their metrics and glyph values into layout units, and assigns stable `fontKey`
and `styleKey` values. See
[`examples/three-webgpu-basic`](../../examples/three-webgpu-basic/) for a complete
single-run implementation.

## Updates and interaction

Properties are mutable; call and await `sync()` after changing them:

```ts
text.input = nextResolvedInput
text.styleColors = { emphasis: 0x66ff88 }
text.opacity = 0.8
await text.sync()

const layout = text.layoutResult
const selection = text.getSelectionRects(0, 5)
```

Calls queued in the same microtask share one promise and commit only the newest
captured state. A failed update rejects without replacing the last successfully
rendered state. `layoutResult` is `null` before the first successful sync, and
selection queries fail explicitly until then.

## Ownership

Each `Text` owns its instanced geometry, unlit node material, glyph cache, RGBA
atlas bytes, and `DataTexture`. Dispose those resources with:

```ts
scene.remove(text)
text.dispose()
```

The application continues to own and dispose font handles, the shared
`WebGPURenderer`, canvas, scene, and camera. `Text.dispose()` is idempotent and
does not touch those resources.

## Supported now

- resolved multilingual runs from `@webgpu-text/layout`;
- lazy numeric outlines from structurally compatible public font handles;
- deterministic CPU SDF generation and per-object RGBA atlas growth;
- flat unlit fill, per-style colors, opacity, and local rectangular clipping;
- promise-based updates, committed layout access, selections, and disposal; and
- Three.js `0.185.1` `WebGPURenderer` through TSL.

Not included: font fetching, automatic itemization or fallback, workers, shared
atlases, eviction, partial texture upload, curvature, strokes/outlines, lighting,
shadows, batching, WebGPU compute SDF generation, WebGL, CommonJS, UMD, or
Troika API compatibility.

## Validation

```sh
pnpm --filter @webgpu-text/three test
pnpm --dir experiments/webgpu-rendering-seam test:browser
```

The browser command requires an actual WebGPU adapter and rejects Three's WebGL
fallback. See
[`docs/validation/three-webgpu-text-core.md`](../../docs/validation/three-webgpu-text-core.md).

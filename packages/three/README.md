# `@webgpu-text/three`

Resolved text rendering for Three.js `WebGPURenderer`, using instanced TSL
materials and private or explicitly shared renderer resources.

## Boundary

The first public API deliberately starts after application-owned font
acquisition, itemization, font selection, shaping, and layout. Pass a completed
renderer-neutral `LayoutResult` and a map of caller-owned `FontHandle` values:

```ts
import { loadFont } from '@webgpu-text/font'
import { getSelectionRects, layoutResolvedText } from '@webgpu-text/layout'
import { Text, TextResources } from '@webgpu-text/three'

const response = await fetch('/fonts/NotoSans-Regular.ttf')
const font = await loadFont(await response.arrayBuffer())
const input = createResolvedInput(font, 'Hello')
const layout = layoutResolvedText(input)
const fonts = new Map([['body', font]])

const resources = new TextResources({ sdfSize: 64 })
const text = new Text({
  layout,
  fonts,
  resources,
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

// Another Text using the same resources and font handle reuses glyph SDFs.
const label = new Text({ layout: labelLayout, fonts, resources })
await label.sync()
scene.add(label)
```

`createResolvedInput` and `layoutResolvedText()` are text preparation, not hidden
renderer helpers. The input builder shapes explicit directional/script runs,
scales metrics and glyph values into layout units, supplies `fontUnitScale`, and
assigns stable `fontKey` and `styleKey` values. The resulting `LayoutResult` can
also be consumed by Canvas, SVG, another GPU renderer, measurement code, or
interaction tools. See
[`examples/three-webgpu-basic`](../../examples/three-webgpu-basic/) for a complete
single-run implementation.

## COLR v0 color glyphs

When a structural font also supplies `getColorLayers()`, the renderer expands a supported COLR v0 glyph into ordered outline instances after layout. Palette-zero RGBA stays in instance data while every layer reuses the ordinary SDF atlas. A layer marked `"foreground"` uses the base glyph's effective `styleColors` entry or `color` value.

The supplied `LayoutResult` is never expanded or replaced: measurement, lines, carets, selections, and font order remain renderer-neutral. Fonts without supported layers—including ordinary fonts and COLR v1 fonts—continue through the single-outline path. The caller still decides which font wins by ordering `fontKeys` during layout; the renderer does not automatically prefer emoji fonts.

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

## Shared resources and ownership

Without a `resources` option, each `Text` creates and owns private renderer
resources. That is the shortest path for a single object:

```ts
scene.remove(text)
text.dispose()
```

For multiple labels, inject one application-owned `TextResources`. It caches a
font-handle/outline-glyph/variation identity once and shares one growing atlas texture;
each text still owns its own geometry, material, appearance, and draw call.
Dispose borrowers before their owner:

```ts
scene.remove(text, label)
text.dispose()
label.dispose()
resources.dispose()
```

Reusing the same font bytes through separately loaded handles does not share a
cache identity. Reuse the caller-owned handle itself when reuse matters. Passing
both `resources` and `sdfSize` is an error because the owner fixes its SDF size.

Color layers use the same monochrome SDF cache and atlas; their palette or foreground RGBA does not duplicate SDF pixels. The resource owner does not provide eviction, partial uploads, workers, or batching, and sharing does not reduce draw calls. The application continues to own font handles, the `WebGPURenderer`, canvas, scene, and camera.

## Supported now

- completed multilingual `LayoutResult` data from `@webgpu-text/layout`;
- lazy numeric outlines from structurally compatible public font handles;
- ordered COLR v0 palette-zero layers, CPAL alpha, current foreground, and ordinary fallback;
- deterministic CPU SDF generation and private or explicitly shared RGBA atlas growth;
- flat unlit fill by default or construction-fixed planar standard lighting;
- glyph-shaped cast and received shadows through ordinary Three.js mesh flags;
- per-style colors, opacity, and local rectangular clipping;
- promise-based updates, committed layout identity, and disposal; and
- Three.js `0.185.1` `WebGPURenderer` through TSL.

Not included: font fetching, automatic itemization or fallback, workers,
eviction, partial texture upload, COLR v1, SVG or embedded-bitmap glyphs,
automatic emoji preference, curvature, strokes/outlines, runtime
material switching, configurable physical-material controls, curved or
double-sided lighting, batching, WebGPU compute SDF generation, WebGL, CommonJS,
UMD, or Troika API compatibility.

## Validation

```sh
pnpm --filter @webgpu-text/three test
pnpm --dir experiments/color-glyph-boundary test:browser
```

The browser command requires an actual WebGPU adapter and rejects Three's WebGL
fallback. See
[`docs/validation/three-webgpu-text-core.md`](../../docs/validation/three-webgpu-text-core.md).

## Context

`@webgpu-text/font`, `@webgpu-text/layout`, and `@webgpu-text/sdf` now expose
the bytes-to-outline, resolved-run-to-layout, and outline-to-pixels contracts
needed by a renderer. The private WebGPU seam experiment has separately proven
instanced bounds, flat RGBA atlas slots, an unlit TSL material, post-render
buffer and texture updates, and disposal on Three.js 0.185.1. The production
`@webgpu-text/three` package is still empty.

The layout boundary is intentionally resolved-first: automatic script and bidi
itemization, fallback selection, and shaping orchestration do not exist yet.
The renderer must therefore compose `ResolvedLayoutInput` honestly rather than
hide a partial raw-string policy inside the Three package. Font bytes and font
handle disposal remain caller-owned, and neither the renderer nor any lower
package may fetch URLs.

## Goals / Non-Goals

**Goals:**

- Provide a small production `Text` mesh over the existing resolved layout and
  CPU SDF APIs.
- Generate glyph outlines and SDFs lazily, cache repeated glyphs, and own the
  complete RGBA atlas and Three texture lifecycle inside each text object.
- Promote the smallest proven instanced geometry and flat unlit TSL material.
- Make synchronization, failed updates, selection access, and disposal
  deterministic and testable.
- Prove the public package with a real-font, multi-cell, actual-WebGPU browser
  fixture and a minimal public-only example.

**Non-Goals:**

- Raw-text itemization, bidi analysis, fallback selection, font fetching, or
  ownership of caller font handles.
- Workers, shared/global atlases, eviction, partial texture uploads, WebGPU
  compute SDF generation, or a configurable cache framework.
- Curved placement, stroke/outline effects, lighting, shadows, PBR materials,
  batching, WebGL support, or arbitrary material derivation.
- Changing the font, layout, or SDF public contracts.

## Decisions

### Start with a resolved-input `Text` facade

`Text` extends Three's `Mesh` and accepts a `ResolvedLayoutInput`, a
`ReadonlyMap<string, TextFont>`, and a small set of renderer properties. A
`TextFont` is the structural subset already provided by `FontHandle`: its
`unitsPerEm` fact and `getOutline()` operation. This lets callers pass public
font handles directly without giving the renderer ownership of them or adding
font fetching.

The initial surface is approximately:

```ts
interface TextOptions {
  input: ResolvedLayoutInput
  fonts: ReadonlyMap<string, TextFont>
  color?: ColorRepresentation
  styleColors?: Readonly<Record<string, ColorRepresentation>>
  opacity?: number
  clipRect?: LayoutBounds | null
  sdfSize?: number
}

class Text extends Mesh {
  input: ResolvedLayoutInput
  fonts: ReadonlyMap<string, TextFont>
  sync(): Promise<void>
  readonly layoutResult: LayoutResult | null
  getSelectionRects(start: number, end: number): readonly SelectionRect[]
  dispose(): void
}
```

Exact supporting type names may be refined during implementation, but the
resolved-input, caller-owned-font, and no-fetch boundaries are fixed. A raw
`text + font` convenience constructor was rejected because it would either be
incorrect for mixed scripts and fallback or silently introduce layout policy
outside `@webgpu-text/layout`. A general renderer/session interface was rejected
because one concrete use does not justify another abstraction.

### Give each `Text` one private atlas

The first implementation keeps a private atlas, glyph cache, `DataTexture`,
geometry, and material per `Text`. There is no process-wide singleton and no
public atlas manager. This is less memory-efficient for many objects, but it
provides unambiguous ownership and is sufficient to ship ordinary text; a
shared atlas belongs with the later measured batching/many-label problem.

The atlas uses fixed square cells and flat slots. Four consecutive slots select
the RGBA channels of one cell; additional cells fill a square grid. When
capacity is exhausted, the grid doubles, existing rows are copied into a new
RGBA `Uint8Array`, and the texture binding is refreshed. Every update marks the
whole texture dirty. Slots are cached for the lifetime of the text object by
font object identity, glyph ID, sorted variation coordinates, and fixed SDF
settings. There is deliberately no eviction or partial upload policy.

Starting with a shared renderer service was rejected because it adds reference
counting, cross-object invalidation, and disposal policy before a benchmark has
shown duplicate atlases to be the limiting cost.

### Derive padded quads from font units and resolved run scale

For an atlas miss, `Text` finds the source run for the positioned glyph, obtains
the caller font by `fontKey`, and calls `getOutline(glyphId, variations)`. The
run scale is `fontSize / unitsPerEm`. The renderer fits the outline bounds into
the fixed SDF cell with deterministic texel padding, supplies the resulting font
unit view box to `generateSdf()`, and scales that same view box into the glyph's
layout-space quad. This keeps atlas sampling and geometry aligned without
putting outlines or SDF metadata into `LayoutResult`.

Glyphs with no drawable outline create no instance. Missing fonts, invalid
units-per-em values, inconsistent run/glyph identity, and generation failures
reject synchronization before any new render state is committed. The prior
committed render state remains usable.

Using only the layout glyph bounds to infer font scale was rejected because
zero-width outlines and rounding can make that ratio undefined or unstable.
Changing `LayoutResult` to include renderer-specific raster metadata was also
rejected because the original resolved input already contains the necessary
font size and identity.

### Coalesce synchronization with one revisioned microtask

All current lower-layer work is synchronous, but the public lifecycle remains
promise-based. `sync()` captures the current immutable input/config references,
increments a revision, and schedules one microtask. Calls made before it runs
share the pending promise and only the latest captured revision is built. A
state is committed atomically only if it is still current and the object has not
been disposed. Errors reject the pending promise without partially changing the
visible mesh; a later valid `sync()` may retry.

This small revision gate provides useful coalescing now and preserves the
observable stale-result rule for later workers without implementing a worker
protocol or cancellation framework prematurely.

### Promote the proven flat unlit rendering kernel

The geometry owns one indexed unit quad plus instanced `glyphBounds`,
`glyphSlot`, and normalized `glyphColor` attributes. Synchronization updates
existing attribute arrays when capacity permits and replaces only undersized
arrays. The mesh keeps stable public identity while its instance count and
bounds follow the newest layout.

The node material retains the experiment's narrow local TSL type facade to
avoid expanding Three's full fluent declaration graph. It maps flat slots to
cell/channel coordinates, samples the renderer-owned RGBA `DataTexture`,
decodes monotonic signed-distance coverage with derivative antialiasing, and
applies per-style color, material opacity, and an optional local rectangular
clip. Ordinary Three object transforms provide orientation; shader curvature is
deferred.

Classic `ShaderMaterial`, `onBeforeCompile()`, GLSL strings, and WebGL backend
branches are prohibited. The package constructs scene objects but never owns a
`WebGPURenderer` or canvas.

### Keep interaction data renderer-neutral

After a successful sync, `layoutResult` exposes the exact committed
`LayoutResult`. `getSelectionRects()` delegates to the existing layout helper
and requires a committed result. The renderer does not create selection meshes
or copy carets into GPU state. This preserves one source of truth for editable
text geometry.

### Separate deterministic and browser evidence

Node/Vitest tests cover atlas allocation, channel packing, growth, cache reuse,
input failure, sync coalescing, failed-update atomicity, disposal, and package
exports without requiring a GPU. A browser fixture uses only public package
exports, a committed public font, real layout and SDF output, more than one
atlas cell, an in-place text/style update, selection access, and repeated
disposal. It must run on the documented Chromium WebGPU configuration and fail
rather than count WebGL fallback as evidence. Semantic region assertions remain
tolerant of reasonable GPU antialiasing differences.

## Risks / Trade-offs

- **Per-object atlases duplicate glyph pixels across many labels** → Keep this
  explicit and add sharing only after ordinary-text benchmarks identify it as a
  practical bottleneck.
- **CPU SDF generation can block a sync microtask for a large first-use glyph
  set** → Keep the first contract correct and profile it; workers remain a
  bounded adapter over the same public inputs.
- **Atlas growth may require rebinding or recreating a Three texture** → Isolate
  texture refresh inside the atlas and cover a real multi-cell growth transition
  in the actual-WebGPU fixture.
- **The resolved-input API is verbose for application authors** → Document one
  complete composition example and add raw-text convenience only after the
  layout package owns itemization and fallback policy.
- **TSL and backend diagnostics remain revision-specific** → Retain the narrow
  facade, pin the initial peer boundary, and rerun the existing seam gate before
  changing Three revisions.
- **Mutable caller maps or font disposal can invalidate a later sync** → Treat
  captured inputs as immutable for one sync, validate every requested font, and
  report typed synchronization errors without disposing caller resources.

## Migration Plan

1. Add public renderer types and validation errors, retaining the empty package's
   existing ESM export shape.
2. Implement and unit-test the private atlas and deterministic glyph-to-SDF
   mapping.
3. Promote the instanced geometry, texture, and narrow-facade TSL material from
   the proven experiment.
4. Implement the revisioned `Text` lifecycle, selection delegation, updates,
   and disposal over real lower-layer contracts.
5. Add public package, browser, and example evidence; then update the roadmap
   and architecture to describe only shipped behavior.
6. Run clean-install package checks, the actual-WebGPU fixture, workspace checks,
   builds, and OpenSpec validation.

Rollback is removal of the new renderer implementation and example. Lower-layer
packages and the private seam experiment remain valid and unchanged.

## Open Questions

- Whether mutating an existing `DataTexture` image across atlas growth is stable
  on Three.js 0.185.1 or whether growth must replace the texture and material
  node atomically; the browser growth fixture decides this implementation
  detail without changing the public API.
- The smallest SDF cell size that produces acceptable ordinary text on the
  reference browser; start with the established 64-pixel CPU fixture scale and
  change it only from visual evidence.

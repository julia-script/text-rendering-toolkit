# Architecture — composable text pipeline

> Proposed greenfield architecture. Package names are placeholders until the npm scope and project name are chosen.

The project should be a small workspace of independently publishable packages, not one indivisible renderer package. A consumer must be able to parse a font without installing Three.js, lay out text without generating an SDF, generate an SDF without using a font parser, or use the complete Three.js WebGPU renderer.

## Executive summary

The preserved `troika-three-text` source already contains several conceptual products, but its file boundaries do not cleanly match those products:

- `FontParser.js` parses font bytes **and** performs font-specific shaping and positioning.
- `FontResolver.js` loads, caches, and selects fallback fonts.
- `Typesetter.js` performs line layout, wrapping, bidirectional ordering, alignment, bounds, and caret generation.
- `SDFGenerator.js` chooses between WebGL and worker-based generation, then writes results into a WebGL canvas.
- `TextBuilder.js` couples typesetting, SDF generation, atlas allocation, canvas growth, Three textures, and render-quad construction.
- `GlyphsGeometry.js`, `TextDerivedMaterial.js`, `Text.js`, and `BatchedText.js` form the Three/WebGL presentation layer.

The greenfield split therefore cuts through `FontParser`, `SDFGenerator`, and especially `TextBuilder`; simply moving each old file into a new package would preserve the existing coupling.

The most important deliberate departure is font shaping. Troika’s custom Typr-based path is retained as evidence and fixture material, but the production font engine will use [HarfBuzzjs](https://github.com/harfbuzz/harfbuzzjs). This avoids carrying a project-owned subset of OpenType shaping into a compatibility-free codebase.

## Implementation status

The greenfield pnpm/Turborepo/Biome/Vitest baseline and all four first
production cores are implemented and validated: `@webgpu-text/font`, resolved
`@webgpu-text/layout`, CPU `@webgpu-text/sdf`, and layout-result
`@webgpu-text/three`. The renderer consumes completed renderer-neutral layout,
caller-owned structural font handles,
lazy numeric outlines, deterministic SDFs, a private growing RGBA atlas,
instanced geometry, and an unlit TSL material through an atomic `Text.sync()`
lifecycle.

Automatic script/direction itemization, font selection and fallback, complete
Unicode line breaking, reshaping around line boundaries, bidi caret affinity,
workers, shared atlas residency/eviction, curved or production lit materials,
and batching remain separate follow-ups. A private actual-WebGPU proof has
validated the public Three.js seam for one front-facing planar standard material
with glyph-shaped cast and received shadows; that evidence has not changed the
shipped unlit API. Font-byte acquisition is caller-owned: no core package
accepts URLs or performs network fetching. The layout package turns fully
resolved runs into `LayoutResult`; the first renderer accepts only that completed
handoff rather than implementing a partial raw-text policy.

## Current responsibility map

```mermaid
flowchart LR
    Bytes[Font bytes] --> Parser[FontParser]
    Parser --> Metrics[Metrics and cmap]
    Parser --> Shape[GSUB, Arabic forms, GPOS and kerning]
    Parser --> Outline[Glyph outlines]

    URLs[Font URLs and fallback policy] --> Resolver[FontResolver]
    Resolver --> Parser
    Resolver --> Typesetter[Typesetter]
    Shape --> Typesetter
    Metrics --> Typesetter
    Typesetter --> Layout[Positioned glyphs, bounds and carets]

    Layout --> Builder[TextBuilder]
    Outline --> Builder
    Builder --> SDF[SDFGenerator]
    SDF --> External[webgl-sdf-generator]
    Builder --> Atlas[Canvas atlas and Three Texture]
    Builder --> Quads[Glyph quad bounds]

    Atlas --> Material[TextDerivedMaterial]
    Quads --> Geometry[GlyphsGeometry]
    Material --> Text[Text and BatchedText]
    Geometry --> Text

    classDef pure fill:#dfe9d2,stroke:#4f6b3c,color:#304326
    classDef mixed fill:#f6e6bf,stroke:#a67c22,color:#6b5118
    classDef renderer fill:#f8d9d2,stroke:#a04434,color:#702f25
    class Metrics,Shape,Outline,Typesetter,Layout pure
    class Parser,Resolver,Builder,SDF mixed
    class Atlas,Material,Geometry,Text renderer
```

### What each preserved module actually owns

| Preserved module | Actual responsibility | Important coupling to remove |
|---|---|---|
| `FontParser.js` | TTF/OTF parsing through Typr, WOFF conversion, font metrics, code-point coverage, GSUB substitutions, Arabic joining forms, GPOS adjustments, kerning, glyph outline extraction and caching | Parsing and shaping are hidden behind one `forEachGlyph` callback API |
| `FontResolver.js` | Fetching, parsing cache, user-font selection, Unicode fallback lookup, style/weight matching | Network I/O and fallback policy are tied to callback and worker factories |
| `Typesetter.js` | Font-run calculation, size/style runs, wrapping, line metrics, alignment, bidi reordering, positioned glyph arrays, bounds, colors, and carets | It receives font objects with shaping callbacks instead of a typed shaping contract |
| `selectionUtils.js` | Caret hit testing and selection rectangles derived only from layout output | None of its behavior requires Three.js or SDF data |
| `SDFGenerator.js` | Scheduling and backend selection around the external `webgl-sdf-generator` package | The module is not the core algorithm; it writes results into a WebGL canvas and manages custom workers |
| `TextBuilder.js` | Argument normalization, worker invocation, global configuration, atlas ownership, glyph cache, SDF requests, texture growth, quad calculation, and final render-info assembly | This is the main cross-layer coupling point and must be decomposed rather than ported intact |
| `GlyphsGeometry.js` | Instanced quad attributes, glyph bounds, atlas indices, colors, and aggregate bounds | Three-specific, but not intrinsically WebGL-specific |
| `TextDerivedMaterial.js` | GLSL injection, SDF decoding, antialiasing, fill/stroke/outline, clipping, orientation, and curved placement | Relies on classic materials, shader rewriting, and WebGL GLSL |
| `Text.js` | Public mutable object, async synchronization, geometry updates, material state, raycasting, clipping, and disposal | Combines consumer API and Three renderer lifecycle |
| `BatchedText.js` | Multi-text packing and batched material/attribute indirection | Renderer optimization; not part of font, layout, or SDF concerns |

## Proposed package graph

```mermaid
flowchart LR
    Font["@scope/font"]
    Layout["@scope/text-layout"]
    Sdf["@scope/sdf"]
    Renderer["@scope/three-webgpu-text"]
    Three["three/webgpu"]
    Bidi["bidi-js"]
    HarfBuzz["vendored HarfBuzzjs runtime"]

    Font -->|internal attributed runtime| HarfBuzz
    Layout -->|runtime dependency| Font
    Layout -->|runtime dependency| Bidi
    Renderer -->|public LayoutResult type| Layout
    Renderer -->|runtime dependency| Sdf
    Renderer -->|peer dependency| Three

    Font -. "structurally compatible outline data" .-> Sdf

    classDef leaf fill:#dfe9d2,stroke:#4f6b3c,color:#304326
    classDef compose fill:#dbe6ee,stroke:#5f83a3,color:#2f4d66
    class Font,Sdf leaf
    class Layout,Renderer compose
```

The arrows are deliberately one-way. In particular:

- `font` knows nothing about layout, workers, SDFs, browsers, or Three.js.
- `text-layout` knows nothing about SDFs, atlases, GPU textures, or Three.js.
- `sdf` knows nothing about fonts, text, layout, browsers, or Three.js.
- `three-webgpu-text` is the only package that depends on Three.js or owns GPU resources.
- No separate shared-types package is introduced. The tiny outline bridge is structural TypeScript data, avoiding a fifth package whose only job is to break dependency cycles.

## Naming direction

The recommended descriptive naming scheme is:

- Project and repository: **WebGPU Text** / `webgpu-text`
- npm scope: `@webgpu-text`
- Packages: `@webgpu-text/font`, `@webgpu-text/layout`, `@webgpu-text/sdf`, and `@webgpu-text/three`

The shorter package names work because the scope supplies the context. The umbrella name mentions WebGPU even though the lower packages are renderer-neutral; it describes the project that publishes them, not their runtime requirements. Registry checks found no currently published packages at those exact four names, but npm scope ownership still needs to be confirmed before treating the names as available.

Two reasonable alternatives are `@glyph-pipeline/*`, which is technically descriptive but less memorable, and a personal or existing organization scope, which is easiest to claim but less project-specific. A coined brand such as `@glyphstack/*` is more distinctive but explains less at first glance.

## Package responsibilities

### `@scope/font`

**Purpose:** turn font bytes and Unicode text runs into reusable font facts, shaped glyphs, and outlines.

**Owns:**

- Font-format detection before HarfBuzz receives the bytes. V1 accepts normalized TTF and CFF/OTF bytes and explicitly rejects WOFF/WOFF2 pending a separate decoder evaluation.
- Persistent HarfBuzz blob, face, font, and reusable shaping-buffer lifetime behind project-owned handles.
- Normalized metrics and code-point coverage.
- HarfBuzz-backed font-specific shaping: cmap lookup, OpenType/AAT substitutions and positioning, script/language features, variation coordinates, clusters, advances, and offsets.
- Glyph IDs, advance/offset values, and outline extraction.
- Lazy numeric outline extraction and in-memory caches scoped to an explicit font instance.

**Inputs:** `ArrayBuffer` or `Uint8Array`, plus shaping text/options.

**Outputs:** an opaque `FontHandle` plus `ShapedRun` and `GlyphOutline` values made only from JavaScript objects and typed arrays.

**Does not own:** URL fetching, fallback-font policy, line wrapping, bidi paragraph layout, SDF encoding, workers, DOM APIs, or Three.js.

The important correction from the old naming is that “font loading,” “font shaping,” and “outline access” are distinct public operations even though one internal HarfBuzz face supports all three. `FontHandle` is an operational handle, not a promise to expose HarfBuzz or a mutable JavaScript object graph of every font table. The name deliberately avoids collision with the browser’s global `FontFace` class. The implemented package accepts owned TTF/OTF bytes, shapes explicit directional/script runs, applies variations per operation, caches numeric outlines lazily, and disposes every owned HarfBuzz object deterministically.

### `@scope/text-layout`

**Purpose:** turn styled Unicode text into positioned glyphs and interaction geometry.

**Owns:**

- The implemented `ResolvedLayoutInput` boundary for fully selected, itemized, shaped, and scaled runs.
- Deterministic hard breaks, whitespace wrapping, alignment, indentation, anchoring, line metrics, and resolved bidi-level visual ordering.
- Positioned glyph instances, block/visible bounds, caret positions, selection rectangles, and point-to-caret hit testing.
- Future automatic itemization/fallback policy over caller-supplied font handles or a caller-supplied provider.
- Future optional ESM worker entry points for moving layout off the main thread.

**Inputs today:** text policy plus `ResolvedShapedRun` values using one effective layout-unit coordinate system.

**Outputs:** a renderer-neutral `LayoutResult` containing glyph references, font identities, positions, font-unit-to-layout-unit scales, bounds, and carets. Outlines are not embedded in the result.

**Does not own:** font-byte acquisition or URL fetching, SDF resolution, atlas indices, textures, materials, scene objects, or renderer synchronization.

This package is useful by itself for editors, DOM/canvas renderers, hit testing, measurement, server-side preprocessing, and non-SDF renderers.

Its policy boundary is fixed by three separate evidence layers: controlled
synthetic resolved runs are the normative layout oracle, public
`@webgpu-text/font` results prove the shaped-run seam, and normalized Troika
observations explain which behavior is preserved or changed. Keeping those
layers separate prevents a HarfBuzz/font revision from silently rewriting
wrapping, alignment, caret, or selection policy.

### `@scope/sdf`

**Purpose:** convert arbitrary vector outlines into renderer-neutral signed-distance-field pixels.

**Owns:**

- The implemented pure CPU `generateSdf()` encoder with deterministic options and output.
- A small typed numeric `SdfOutline` contract structurally compatible with public font outlines.
- Self-describing one-channel `Uint8Array` output and encoding metadata.
- Strict validation, fixed curve flattening, non-zero winding, and attributed golden conformance.
- Future optional ESM worker adapters for parallel generation.

**Inputs:** an outline, view box, output dimensions, distance range, and exponent.

**Outputs:** `SdfBitmap` data only; never an atlas, canvas, or GPU texture.

**Does not own:** font parsing, glyph selection, text layout, workers, caching, atlas policy, DOM canvas, WebGL, WebGPU, or Three.js.

The preserved `SDFGenerator.js` is mostly scheduling and WebGL/canvas integration. The implemented CPU encoder adapts only the MIT-licensed `webgl-sdf-generator@1.1.1` numeric behavior, preserves its copyright and license, and records the derivation in package and root notices. SVG parsing, WebGL, canvas, framebuffer, and worker paths are excluded.

### `@scope/three-webgpu-text`

**Purpose:** render completed layout data as a convenient Three.js `WebGPURenderer` scene object.

**Owns:**

- The implemented layout-result `Text` mesh and latest-state promise synchronization lifecycle.
- Lazy outline/SDF orchestration, failure atomicity, and committed layout identity.
- One private atlas per text: flat-slot allocation, RGBA channel packing, byte storage, square growth, full dirty uploads, glyph cache, and lifecycle. V1 has no eviction.
- RGBA atlas upload into a Three `DataTexture`.
- Capacity-aware instanced glyph geometry and explicit bounds.
- The implemented flat unlit TSL material for placement, SDF decoding, derivative antialiasing, fill, per-style color, opacity, and rectangular clipping.
- Lifecycle-safe disposal that leaves caller fonts, renderer, and canvas alone.
- Future batching, if profiling demonstrates a need.

**Inputs today:** a completed public `LayoutResult`, a structural map of caller-owned lazy-outline handles, and baseline appearance values.

**Outputs:** Three scene objects and GPU resources.

**Does not own:** font bytes or fetching, caller font lifetime, itemization/fallback, font table parsing algorithms, line layout or interaction algorithms, the CPU SDF encoder, workers, a shared renderer/canvas, or WebGL support.

## Boundary contracts

The exact TypeScript names are provisional; the separation is not.

| Contract | Producer | Consumers | Contains | Explicitly excludes |
|---|---|---|---|---|
| `FontHandle` | `font` | `text-layout`, direct users | normalized metrics, coverage, shaping and lazy outline access | HarfBuzz pointers, network state, layout settings, atlas state |
| `ShapedRun` | `font` | `text-layout`, direct users | glyph IDs, cluster/source indices, advances, offsets | line breaks, final x/y placement |
| `LayoutResult` | `text-layout` | renderers, editors, direct users | positioned glyph references, font keys, font-unit scales, bounds, line data, carets | outlines, font handles, SDF pixels, atlas indices, Three objects |
| `GlyphOutline` | `font` | `sdf`, renderer orchestration, direct users | path commands and view box for one glyph reference | placement, SDF pixels, atlas state |
| `Outline` | any producer | `sdf` | path commands and view box | font tables, text, placement |
| `SdfBitmap` | `sdf` | renderer, direct users | one-channel pixels and encoding metadata | canvas and GPU handles |
| `RendererAtlas` | renderer | renderer internals | RGBA bytes, slot metadata, dirty regions, cache and Three texture | public SDF API and parser details |
| `TextRenderState` | renderer | renderer internals | geometry attributes, atlas bindings, material values | parser implementation details |

### End-to-end composition

```mermaid
sequenceDiagram
    participant App
    participant Font as @scope/font
    participant Layout as @scope/text-layout
    participant SDF as @scope/sdf
    participant Three as @scope/three-webgpu-text
    participant GPU as Three WebGPURenderer

    App->>App: acquire bytes by application policy
    App->>Font: load(fontBytes)
    Font-->>App: FontHandle
    App->>Font: shape selected directional/script runs
    Font-->>App: ShapedRun in font units
    App->>App: scale and assemble ResolvedLayoutInput
    App->>Layout: layoutResolvedText(input)
    Layout-->>App: LayoutResult
    App->>Three: create/update with LayoutResult and font registry
    Three->>Font: getOutline(glyphId) on atlas miss
    Font-->>Three: GlyphOutline
    Three->>SDF: generate(outline, options)
    SDF-->>Three: SdfBitmap
    Three->>Three: allocate and pack renderer-owned atlas
    Three->>GPU: upload atlas and render TSL material
```

Text preparation ends at `LayoutResult`; the Three adapter performs only the
lazy outline, SDF, atlas, and GPU calls after that handoff. Another renderer can
consume the same result and choose a different outline or raster strategy.

## Consumption examples

### Parse and shape a font only

```ts
import { loadFont } from '@webgpu-text/font'

const font = await loadFont(await fontBytes.arrayBuffer())
const run = font.shape({
  text: 'office',
  direction: 'ltr',
  script: 'Latn',
  language: 'en',
  features: ['liga=1']
})
const outline = font.getOutline(run.glyphs[0].glyphId)
font.dispose()
```

### Lay out text without rendering it

```ts
import { layoutResolvedText } from '@webgpu-text/layout'

// The application acquires bytes, selects fonts, itemizes, shapes, and scales
// runs before this pure call. See packages/layout/README.md for the full shape.
const result = layoutResolvedText(resolvedInput)
```

### Generate an SDF from an arbitrary outline

```ts
import { generateSdf } from '@scope/sdf'

const bitmap = generateSdf({
  outline,
  width: 64,
  height: 64,
  distance: 8,
  exponent: 9
})
```

### Use the complete Three.js WebGPU layer

```ts
import { Text } from '@scope/three-webgpu-text'

const text = new Text({
  layout: layoutResolvedText(resolvedLayoutInput),
  fonts: new Map([['body', font]]),
  color: 0xffffff
})

await text.sync()
scene.add(text)
```

## Proposed workspace structure

```text
.
├── packages/
│   ├── font/
│   │   ├── src/
│   │   └── test/
│   ├── text-layout/
│   │   ├── src/
│   │   └── test/
│   ├── sdf/
│   │   ├── src/
│   │   └── test/
│   └── three-webgpu-text/
│       ├── src/
│       └── test/
├── examples/
│   ├── layout-only/
│   ├── sdf-only/
│   └── three-webgpu-basic/
├── test-fixtures/
│   ├── fonts/
│   ├── shaping/
│   ├── layout/
│   ├── sdf/
│   └── visual/
├── openspec/
├── ARCHITECTURE.md
├── ROADMAP.md
└── package.json
```

The workspace can publish four packages from one repository and version them together initially. Independent versioning is unnecessary until their release cadence actually diverges.

## Source migration map

| Preserved source | Destination | Migration treatment |
|---|---|---|
| `FontParser.js` metrics, coverage, and font-facing contracts | `font` | Preserve behavior as fixtures and reimplement the public operations over HarfBuzzjs rather than porting the parser mechanically |
| `FontParser.js` GSUB/GPOS, joining, glyph mapping, and kerning | `font` shaping adapter | Replace with HarfBuzz shaping; retain representative old outputs only for comparison and intentional-difference review |
| `FontParser.js` outline cache | `font` outline adapter | Preserve lazy/cache behavior with direct numeric HarfBuzz callbacks and a glyph/variation cache; never use its SVG round-trip |
| `woff2otf.js`, generated Typr factory, and Typr sources | local reference only | Do not port into the production runtime. V1 accepts normalized TTF/OTF and rejects WOFF/WOFF2 explicitly; decoder evaluation is separate follow-up work |
| `FontResolver.js` | future `text-layout` selection policy plus application adapters | Preserve only pure selection/fallback ideas; applications own byte acquisition, while optional helpers may own URL/cache convenience outside the core path |
| `Typesetter.js` | `text-layout` | Split run shaping, line construction, bidi placement, result assembly, and interaction data while preserving fixtures |
| `selectionUtils.js` | `text-layout` | Port as pure helpers over `LayoutResult` |
| CPU behavior behind `SDFGenerator.js` | `sdf` | Port the MIT-licensed CPU encoder with its notice and golden fixtures; expose pure typed-array input/output; delete WebGL and canvas paths |
| Atlas allocation currently in `TextBuilder.js` | `three-webgpu-text` | Own byte packing, cache policy, growth, dirty tracking, GPU residency, and texture lifecycle entirely in the renderer |
| Layout invocation in `TextBuilder.js` | `three-webgpu-text` orchestration | Replace callbacks and globals with injected package APIs and promises |
| Quad calculation in `TextBuilder.js` | `three-webgpu-text` | Derive render bounds from `LayoutResult` and atlas slots |
| `GlyphsGeometry.js` | `three-webgpu-text` | Port instanced geometry and typed attributes |
| `TextDerivedMaterial.js` | `three-webgpu-text` | Rewrite behavior in TSL; do not port GLSL injection machinery |
| `Text.js` | `three-webgpu-text` | Redesign as the high-level façade with explicit ownership and disposal |
| `BatchedText.js` | deferred renderer work | Revisit only after benchmarks establish the need |

## Worker and environment rules

Workers are execution adapters, not a fifth domain package:

- `text-layout` may expose `@scope/text-layout/worker` while keeping the synchronous engine usable in Node.js and tests.
- `sdf` may expose `@scope/sdf/worker` while keeping the pure encoder callable directly.
- `three-webgpu-text` chooses whether to use those worker adapters and owns cancellation/coalescing across an object’s `sync()` calls.
- Lower-level packages must not reference `window`, `document`, canvas, WebGL, WebGPU, or Three.js at module evaluation time.
- Worker messages carry public typed contracts or transferable typed arrays, not private class instances.

## Testing boundaries

Each package gets tests at its own contract:

- `font`: binary fixtures, metrics, coverage, Latin/Arabic/Indic/Khmer shaping clusters, advances, offsets, variation behavior, and numeric outlines; the spike also records WASM startup and repeated-shaping memory behavior.
- `text-layout`: deterministic multilingual glyph placement, wrapping, bidi, bounds, carets, and selection fixtures.
- `sdf`: golden pixel fixtures and encoding invariants, with no GPU required.
- `three-webgpu-text`: atlas packing/growth invariants, browser-rendered visual fixtures, texture lifecycle tests, synchronization races, and disposal.

Cross-package integration fixtures cover only the contracts between packages. This prevents renderer failures from being mistaken for parser failures and allows each lower layer to be validated without a GPU.

The accepted layout corpus and implementation handoff are documented in
[`docs/validation/layout-policy.md`](docs/validation/layout-policy.md). Its
synthetic fixtures are production conformance inputs; its real-font records are
boundary observations. They prove the resolved layout core, not automatic
itemization, provider/fallback policy, or worker support.

## Architectural rules for future changes

1. A lower-level package cannot import a higher-level package.
2. Only `three-webgpu-text` may import `three`.
3. Only `text-layout` decides line placement and caret geometry.
4. Only `sdf` defines SDF encoding; only the renderer decodes it in TSL.
5. Applications own font-byte acquisition. Any future URL/cache helper and workers are optional adapters around pure operations, never prerequisites or core-package behavior.
6. Global mutable configuration and process-wide singleton atlases are prohibited.
7. Every package must have at least one direct consumer example that imports no higher layer.
8. A new package requires an independently useful public capability, not merely a convenient folder boundary.

## Resolved decisions

### Use HarfBuzzjs as the font and shaping engine

Troika does not merely import a parser. It layers custom Arabic joining, selected GSUB/GPOS handling, kerning, cluster mapping, and outline behavior on top of a generated Typr build. Porting that code would make this project responsible for a partial OpenType shaping engine indefinitely. That cost is not justified when compatibility with Troika’s exact shaping output is explicitly out of scope.

The first `font` implementation therefore wraps [HarfBuzzjs](https://github.com/harfbuzz/harfbuzzjs) behind stable `FontHandle`, `ShapedRun`, and `GlyphOutline` contracts. HarfBuzz owns font-specific glyph substitution and positioning. The implemented layout core owns line construction, wrapping, resolved bidi-level visual placement, carets, and selection geometry. Automatic fallback and directional/script itemization remain future layout policy over caller-supplied fonts; they do not imply URL fetching.

HarfBuzzjs exposes the font facts needed by v1, so the project does not need a second general-purpose parser such as OpenType.js or Fontkit. The published 1.4.0 wrapper's public surface renders glyphs only through SVG-string convenience methods, but its packaged WASM already exports the required drawing functions. A general table-inspection or font-editing API remains a separate future capability, not a dependency of text rendering.

The production package vendors the exact validated HarfBuzzjs runtime behind a narrow, non-exported bridge. Its adapter asks HarfBuzz to draw directly into project-owned typed numeric commands on demand, never calls `glyphToPath()` or `glyphToJson()`, and explicitly destroys the wrapper objects it owns. The bridge is intentionally replaceable by a future upstream public drawing and destruction API without changing the package contracts.

```mermaid
flowchart LR
    Bytes[TTF or OTF bytes] --> Detect[Detect and reject unsupported containers]
    Detect --> Blob[Persistent HarfBuzz Blob]
    Blob --> Face[Persistent HarfBuzz Face and Font]
    Run[Directional script run] --> Buffer[Reusable HarfBuzz Buffer]
    Face --> Shape[HarfBuzz shape]
    Buffer --> Shape
    Shape --> Result[ShapedRun with UTF-16 clusters]
    Result --> Miss[Glyph requested on atlas miss]
    Face --> Draw[HarfBuzz glyph drawing callbacks]
    Miss --> Draw
    Draw --> Outline[Cached numeric GlyphOutline]
```

The published wrapper is ESM with TypeScript declarations, but it is not zero-allocation: it copies font bytes into WASM memory, creates temporary storage when adding text, and materializes JavaScript result objects. The validation spike measured a 474,766-byte raw / 179,099-byte gzip published runtime, approximately 11 μs per warm short-run shape on its reference machine, and stable sampled external memory during 5,000 shapes with one reused buffer. These figures are observations, not budgets.

The published wrapper exposes GC fallback through `FinalizationRegistry` but no public explicit destruction. The internal bridge reuses those registered cleanup closures so `FontHandle.dispose()` deterministically releases its HarfBuzz buffer, font, face, and blob; worker termination remains the deterministic whole-engine boundary for the singleton WASM runtime itself.

The validated input policy is TTF and CFF/OTF only. The tested WOFF and WOFF2 containers yielded no usable character map and must fail with a typed unsupported-format error before face construction. Decoder API, size, and licensing are bounded follow-up work rather than a hidden production dependency.

### Resolve outlines lazily

`LayoutResult` carries stable font/glyph references, not vector paths. The
implemented resolved core leaves outline lookup with the caller's font registry.
A future high-level session may proxy lazy lookups to a worker, but it must not
make outlines eager or take ownership of font acquisition. The renderer requests
an outline only when a glyph is missing from its atlas, then the font backend and
renderer can cache the result.

This keeps ordinary measurement, caret, and hit-testing use cases from paying outline computation, transfer, and memory costs. A future serialization helper may materialize all outlines, but v1 will not add an `includeOutlines` layout option.

### Keep atlas ownership in the renderer

`sdf` ends at `SdfBitmap`. `three-webgpu-text` owns allocation, channel packing, growth, dirty tracking, eviction, `DataTexture` upload, and disposal. This keeps the reusable SDF package small and lets renderer-specific performance work evolve without changing the SDF contract.

### Use the proven TSL/WebGPU rendering kernel

The private `prove-webgpu-rendering-seam` experiment validated Three.js 0.185.1 on an actual Apple Metal-backed WebGPU adapter. The viable production kernel is deliberately smaller than Troika's renderer layer:

```mermaid
flowchart LR
    Input["Glyph bounds, flat atlas slot, color"] --> Geometry["Instanced unit quad"]
    Bitmap["One-channel SdfBitmap"] --> Atlas["Renderer-owned RGBA atlas"]
    Atlas --> Texture["DataTexture and dirty upload"]
    Geometry --> Material["Unlit TSL material"]
    Texture --> Material
    Appearance["Opacity, clip, orientation, curvature"] --> Material
    Material --> WebGPU["Three WebGPU backend"]

    App["Application"] --> Renderer["Shared WebGPURenderer and canvas"]
    Renderer --> WebGPU
```

The flat atlas slot is the renderer-neutral geometry value: `cell = floor(slot / 4)` and `channel = slot % 4`. The renderer derives cell UVs from atlas dimensions/cell size and selects the packed RGBA channel in TSL. `sdf` remains unaware of cells, channels, textures, and Three.js.

Production ownership differs from the self-contained experiment harness. A text object owns its instanced geometry and node material and releases its atlas references. The renderer atlas owner owns packing, cache state, texture updates, and texture disposal. The application owns the shared `WebGPURenderer` and DOM canvas; creating a renderer per text object is prohibited.

The original experiment proved one-cell/four-channel rendering, semantic SDF
coverage, opacity, clipping, orientation, cylindrical placement, in-place
texture/attribute updates, and create-render-update-dispose reuse. The shipped
renderer follow-up then proved real-font SDFs and multi-cell atlas growth. Atlas
eviction, partial texture upload, production lighting, and batching remain
separate work.

Three's renderer-backend identity and TSL surface remain revision-specific boundaries. The private validation may inspect `renderer.backend.isWebGPUBackend` for pinned actual-WebGPU evidence, but that diagnostic must not spread through the public API. The TSL implementation should remain behind a narrow local adapter: Three's complete fluent TSL declarations caused pathological TypeScript 7.0.2 memory growth during the spike. Every Three revision change must rerun the browser validation before the supported range changes.

See [the complete validation report](docs/validation/webgpu-rendering-seam.md) for the recorded environment, evidence, limitations, and promotion contract.

### Use the validated planar lighting and shadow seam

The private `prove-lit-text-shadow-seam` experiment validates one deliberately
narrow path on the same Three.js 0.185.1 and Apple Metal WebGPU environment:

```mermaid
flowchart LR
    Geometry["Instanced planar glyph quad<br/>normal 0,0,1"] --> Position["Shared positionNode"]
    Atlas["RGBA SDF atlas"] --> Sample["Shared channel sample"]
    Color["Per-instance RGBA colorNode"] --> Standard["MeshStandardNodeMaterial"]
    Sample --> Visible["Derivative opacityNode"]
    Sample --> ShadowMask["Binary maskShadowNode"]
    Position --> Standard
    Visible --> Standard
    ShadowMask --> ShadowPass["Visible-side shadow pass"]
    Standard --> LitPass["Scene lighting and received shadows"]
    ShadowPass --> Receiver["Glyph-shaped cast shadows"]
```

The visible and shadow passes reuse the same instanced `positionNode`; no
`castShadowPositionNode` is required. Visible edges retain derivative
antialiasing through `opacityNode`, while the shadow pass uses a binary
`maskShadowNode` at the encoded SDF midpoint so transparent quad margins and
shape cutouts do not cast. The per-instance color is supplied as opaque RGBA for
the shadow override path. A front-facing planar normal is ordinary geometry
data, not a custom lighting node.

One revision-specific behavior is essential: Three normally flips a material's
side in its shadow override. A zero-thickness front-facing text plane therefore
casts nothing unless its public `shadowSide` is explicitly set to the visible
side. With that setting, the experiment measured distinct rectangle and circle
silhouettes, transparent cutouts, and an external shadow darkening only visible
glyph coverage. `castShadowNode`, transmitted shadows, duplicate shadow meshes,
private renderer APIs, and shader strings were not needed.

This evidence supports a future dedicated planar standard-material variant; it
does not choose its public constructor/option shape or validate curved,
double-sided, extruded, physical, or normal-mapped text. The shipped `Text`
material remains unlit until that bounded integration is specified and tested
with the real-font production lifecycle. See the
[lit/shadow validation report](docs/validation/lit-text-shadow-seam.md).

### Reuse MIT sources with explicit provenance

The CPU SDF implementation is derived from `webgl-sdf-generator@1.1.1`, whose [package](https://www.npmjs.com/package/webgl-sdf-generator) and [source license](https://github.com/lojjic/webgl-sdf-generator/blob/master/LICENSE.txt) identify it as MIT. Its full terms, npm integrity, adapted functions, excluded paths, and one intentional distance-clamping correction are recorded in `packages/sdf/THIRD_PARTY_NOTICES.md` and the root `NOTICE.md`. Troika and Typr also declare MIT licenses, and HarfBuzzjs publishes an MIT license. Every later import still requires a file-by-file audit rather than assuming every transitive source or generated asset shares one license.

## Decisions still open

- Whether to adopt the recommended `WebGPU Text` / `@webgpu-text/{font,layout,sdf,three}` naming scheme or choose one of the alternative scopes.

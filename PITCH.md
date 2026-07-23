# WebGPU Text — Pitch

A small family of independently usable packages that turn font bytes and Unicode
text into GPU-rendered glyphs on Three.js `WebGPURenderer`. It stands on the
mature Unicode, layout, and signed-distance-field work proven by
`troika-three-text` — the reference that made this possible — and re-targets it
for the WebGPU era: TSL node materials instead of GLSL rewriting, explicit data
contracts instead of a callback API, native ESM instead of a global build
system, and strict TypeScript throughout.

The bet is that text rendering is not one indivisible renderer — it's four
distinct products that happen to compose. Most libraries fuse them, so a
consumer who only wants to *measure* text still drags in a GPU. Here the seams
are the product: parse a font without Three.js, lay out a paragraph without an
SDF, generate an SDF without a font, or take the whole renderer. Each layer is
useful on its own, and every dependency arrow points one way.

## The parts

### `@webgpu-text/font` — parse, shape, outline

Font bytes in, reusable font facts out. Wraps HarfBuzz (vendored WASM) behind a
stable `FontHandle` so you get real OpenType shaping — cmap, GSUB/GPOS,
script/language features, variation axes, clusters, advances, offsets — plus
lazy numeric glyph outlines and COLR v0 color layers, without ever exposing a
HarfBuzz pointer. Deterministic disposal releases every owned WASM object. It
knows nothing about URLs, layout, SDFs, browsers, or Three.js. **Useful alone
for:** anyone who needs correct shaping or metrics in Node or the browser.

### `@webgpu-text/layout` — resolve, wrap, place, select

Styled Unicode text in, positioned glyphs and interaction geometry out. Owns the
two-stage boundary the whole design rests on: `prepareText()` does the
font-independent work (grapheme segmentation, bidi levels, script itemization,
Unicode 13 line-break opportunities) and returns immutable serializable JSON;
`layoutPreparedText()` then selects caller-supplied fonts, shapes, wraps, places,
and emits a renderer-neutral `LayoutResult` with carets, selection rectangles,
and hit testing. Also derives solid/dotted/wavy underline and strikethrough
segments as pure analytic geometry. No SDFs, no atlases, no GPU, no Three.js.
**Useful alone for:** editors, canvas/SVG/DOM renderers, measurement,
server-side preprocessing.

### `@webgpu-text/sdf` — outline to pixels

An arbitrary vector outline in, a one-channel signed-distance-field bitmap out.
A pure CPU encoder derived from the MIT `webgl-sdf-generator`, with deterministic
options, golden-pixel conformance, and no GPU required. It returns bytes and
encoding metadata — never an atlas, canvas, or texture. It doesn't know what a
font or a glyph is. **Useful alone for:** any renderer that wants SDF coverage
from shapes it already has.

### `@webgpu-text/three` — the composed renderer

A completed `LayoutResult` and a map of font handles in, a Three.js `Mesh` out.
This is the *only* package that imports Three or owns GPU resources. It
orchestrates lazy outline lookup on atlas misses, SDF generation, an RGBA atlas
that grows in place, instanced geometry, and shared TSL nodes — bound to either a
default unlit material or an opt-in planar standard material with real cast and
received shadows. Outline and drop-shadow paint decode the same SDF slot.
Everything commits atomically behind `Text.sync()`; a stale async result never
overwrites newer state. **Useful alone for:** dropping multilingual, colored,
shadowed text into a WebGPU scene.

## Why this exists at all

Every published release of `troika-three-text` targets `WebGLRenderer`: its
material system rewrites GLSL through `onBeforeCompile`, a hook the
`WebGPURenderer` never runs. Its last npm release was April 2025. A community
TSL port is in progress and maintainer-welcomed, but it isn't merged or
released, and an official migration is explicitly constrained by maintaining
both renderer paths at once. Three.js
is moving to WebGPU/TSL, so multilingual SDF text on the modern renderer is a
real gap today. This project takes the other route to the same goal: rather than
retrofitting a WebGL-era codebase, it's WebGPU-first and TSL-native from the
ground up, with no dual-renderer compatibility debt shaping the design.

## Why the split earns its keep

`troika-three-text` was built as one cohesive renderer, so its file boundaries
follow the WebGL pipeline rather than the standalone products hiding inside it:
`FontParser` handles parsing and shaping together, `SDFGenerator` wraps an
external encoder alongside WebGL/canvas plumbing, and `TextBuilder` ties the
layers together. Those were reasonable choices for a single renderer; this
project just wants them as separately shippable packages. So the greenfield cut
runs *through* those files, not around them — which is why this is a rewrite
behind preserved fixtures rather than a port. The payoff is that a font-only
consumer never pays for bidi, an SDF-only consumer never pays for a font parser,
and only one package is ever revision-locked to Three.js.

---

## Goals

- **Renderer-neutral by construction.** `LayoutResult` is the complete, GPU-free
  handoff. Any renderer — Three, canvas, SVG, native — can consume it. Three
  performs zero shaping, layout, caret, or selection policy.
- **Independent, publishable layers.** Four packages, one-way dependencies, each
  with a direct-consumer example that imports no higher layer. A new package
  requires a genuinely independent public capability, not a folder boundary.
- **Correct multilingual text.** Real HarfBuzz shaping, bidi, script itemization,
  explicit caller-font fallback, Unicode line-break opportunities, and COLR v0
  color glyphs — not a project-owned subset of OpenType.
- **WebGPU-first, ESM-only, strict TypeScript.** No WebGLRenderer, no
  CommonJS/UMD, no global mutable config, no `troika-three-text` compatibility
  debt.
- **Application-owned resources.** Callers own font-byte acquisition and font
  lifetime; the core never fetches URLs. Renderer resources are private by
  default and explicitly shareable.
- **Evidence-backed changes.** Every non-trivial capability lands with
  deterministic fixtures plus actual-WebGPU (Apple Metal) validation before it's
  promoted.

## Non-goals

- **No `WebGLRenderer` support.** The project exists specifically to be a clean
  `WebGPURenderer` implementation; a dual-renderer path is the constraint it was
  designed to escape.
- **No CommonJS or UMD.** Native ESM is the only distribution format.
- **No `troika-three-text` API compatibility.** Compatibility would force old
  callbacks, material derivation, and global configuration into the new design.
- **No arbitrary classic Three materials.** v1 ships dedicated unlit and planar
  standard node materials; further variants require concrete demand.
- **No fetch-only font pipeline.** Every core operation works from caller-owned
  bytes and handles, so each layer stays testable and portable; URL fetching may
  ship as a convenience, but never as the main or only path.
- **No speculative optimization.** Batching, compute-shader SDF generation, and
  atlas eviction wait for profiling evidence, not folklore.

## Audience

- **Three.js / WebGPU app developers** who need production-quality multilingual,
  colored, and shadowed text and have outgrown WebGL-era text libraries.
- **Editor and tooling builders** who need shaping, layout, carets, and selection
  geometry with no GPU dependency — consuming `@webgpu-text/layout` directly.
- **Renderer authors** (canvas, SVG, native, custom GPU) who want a
  renderer-neutral layout result or a pure SDF encoder without adopting Three.
- **Library and framework integrators** (e.g. React Three Fiber) who want a
  small, stable, ESM-native core to build on.
- **Contributors and reviewers** who benefit from strict layer boundaries that
  keep a renderer bug from masquerading as a parser bug.

## Success criteria

- **Composability holds:** each package is installable and useful without any
  higher layer, proven by a standalone consumer example and passing packed-tarball
  checks — no workspace links required.
- **Correctness is validated, not asserted:** deterministic fixtures for shaping,
  layout, and SDF encoding pass, and real-font text renders on actual Apple Metal
  WebGPU (never WebGL fallback as passing evidence).
- **Boundaries stay clean:** lower layers never import higher ones, only
  `@webgpu-text/three` imports Three, and `LayoutResult` remains free of outlines,
  SDF pixels, atlas indices, and Three objects.
- **Multilingual fidelity:** mixed LTR/RTL, script itemization, caller-font
  fallback, COLR v0 color glyphs, and analytic decorations render correctly
  across the accepted corpus.
- **Lifecycle safety:** concurrent `sync()` calls coalesce to the latest state,
  disposal releases owned GPU and WASM resources, and shared resources survive
  borrower churn without visual change.
- **Ready to publish when chosen:** package identity, license, versioning,
  metadata, and provenance are bounded and audited; public release is a decision,
  not remaining engineering work.

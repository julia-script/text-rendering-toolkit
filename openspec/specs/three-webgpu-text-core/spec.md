# three-webgpu-text-core Specification

## Purpose

Define the production renderer-neutral-layout Three.js WebGPU text mesh,
including synchronization, lazy glyph rasterization, renderer-owned atlas
resources, instanced TSL rendering, validation evidence, and disposal.

## Requirements

### Requirement: Expose a layout-result Three text mesh
`@webgpu-text/three` SHALL expose a `Text` scene object that accepts a completed
renderer-neutral `LayoutResult`, a caller-owned font registry keyed by the
result's font identities, and baseline appearance options without fetching font
bytes, executing text layout, deriving interaction geometry, or performing
automatic itemization or fallback selection.

#### Scenario: Construct prepared text
- **WHEN** a caller constructs `Text` with a valid multilingual `LayoutResult` and
  structurally compatible public font handles
- **THEN** the object is a Three mesh that can be added to a scene before its
  first synchronization and neither fetches nor disposes those font handles

#### Scenario: Reject an unavailable font
- **WHEN** synchronization needs a drawable glyph whose font key is absent or
  whose lazy outline lookup fails
- **THEN** synchronization rejects with a public renderer error before committing
  partial geometry or atlas state

#### Scenario: Keep text policy outside Three
- **WHEN** the Three package constructs, synchronizes, updates, or disposes a text
  mesh
- **THEN** it does not invoke layout, shaping, selection, caret, bidi, fallback,
  or line-breaking operations

### Requirement: Synchronize and update atomically
`Text.sync()` MUST return a promise, coalesce requests pending in the same work
window behind the latest captured state, and commit the supplied layout, atlas,
geometry, and material state atomically only when that request is still current.

#### Scenario: Synchronize an initial state
- **WHEN** a caller awaits `sync()` for a valid non-empty or empty `LayoutResult`
- **THEN** the promise resolves with committed layout identity, instance count, render bounds,
  atlas contents, and appearance controls representing that captured state

#### Scenario: Coalesce rapid updates
- **WHEN** the layout or appearance properties change and `sync()` is called
  repeatedly before pending work commits
- **THEN** the calls settle behind the newest request and no older state
  overwrites its layout reference, pixels, attributes, or material values

#### Scenario: Preserve a committed state after failure
- **WHEN** an update fails during renderer validation, outline lookup, or SDF
  generation
- **THEN** its promise rejects, the last successfully committed render state
  remains intact, and a later valid synchronization can succeed

### Requirement: Resolve and rasterize glyphs lazily
The renderer SHALL request an outline and generate an SDF only for a drawable
font/glyph/variation identity missing from that text object's cache, using the
positioned glyph's `fontUnitScale` to map one deterministic padded SDF view box
to its layout-space quad.

#### Scenario: Rasterize an atlas miss
- **WHEN** a positioned glyph has a drawable outline that is not cached
- **THEN** the renderer obtains the outline on demand, passes its numeric commands
  directly to `generateSdf()`, and scales the padded view box by the glyph's
  `fontUnitScale` without consulting resolved runs or font facts

#### Scenario: Reuse a repeated glyph
- **WHEN** the same font object, glyph ID, variation coordinates, and SDF settings
  occur repeatedly or in a later synchronization
- **THEN** all instances reuse one atlas slot without repeating outline extraction
  or SDF generation

#### Scenario: Ignore a non-drawing glyph
- **WHEN** a laid-out glyph has no drawable outline
- **THEN** it remains represented in the caller-owned layout result but creates
  no atlas slot or render instance

### Requirement: Own an RGBA glyph atlas
Each `Text` object SHALL privately own deterministic flat-slot allocation, RGBA
channel packing, byte storage, growth, dirty texture upload, cache lifetime, and
texture disposal without exposing atlas policy through the SDF or layout
packages.

#### Scenario: Pack slots across cells and channels
- **WHEN** five or more distinct drawable glyphs are synchronized
- **THEN** slots zero through three occupy separate channels of the first cell and
  later slots occupy subsequent cells without channel contamination

#### Scenario: Grow the atlas
- **WHEN** a new glyph exceeds current slot capacity
- **THEN** the renderer expands the atlas, preserves every existing cell byte and
  slot identity, refreshes the bound Three texture, and renders old and new glyphs
  correctly

#### Scenario: Upload a dirty atlas
- **WHEN** synchronization packs one or more new bitmaps after an earlier rendered
  frame
- **THEN** the next WebGPU frame observes the complete updated atlas while cached
  slots remain stable

### Requirement: Render instanced unlit SDF text through TSL
The package MUST render one indexed unit quad per drawable glyph through
instanced bounds, flat atlas slot, and normalized color attributes plus a TSL
node material that provides RGBA channel selection, derivative-antialiased SDF
coverage, opacity, and optional local rectangular clipping.

#### Scenario: Render positioned real-font glyphs
- **WHEN** a synchronized text mesh is rendered by the pinned Three.js
  `WebGPURenderer`
- **THEN** glyph instances occupy the positions and padded bounds derived solely
  from the supplied layout and positioned font-unit scale with transparent
  exterior and antialiased interior coverage

#### Scenario: Apply baseline appearance
- **WHEN** glyph style keys select different colors and the text uses opacity or
  a local clip rectangle
- **THEN** the WebGPU frame preserves per-style colors, bounded opacity blending,
  and clipping without shader-string rewriting or a WebGL-specific API

#### Scenario: Update an existing mesh
- **WHEN** a later synchronization supplies another completed layout or changes
  style colors, opacity, or clipping
- **THEN** the same public `Text` object renders the new state and does not recreate
  the application-owned renderer or canvas

### Requirement: Choose planar lighting at construction
`@webgpu-text/three` SHALL let a caller choose the existing unlit material or one
dedicated planar standard material when constructing `Text`, and SHALL keep that
choice fixed for the object's lifetime.

#### Scenario: Preserve the unlit default
- **WHEN** a caller constructs `Text` without a lit option or explicitly disables it
- **THEN** the mesh uses the existing unlit node material and retains its accepted rendering behavior

#### Scenario: Construct planar lit text
- **WHEN** a caller constructs `Text` with the lit option enabled
- **THEN** the mesh uses a standard node material with fixed planar normals and the same completed-layout, font-registry, atlas, appearance, synchronization, and ownership boundaries as unlit text

#### Scenario: Keep material kind immutable
- **WHEN** layout or mutable appearance properties change and the caller synchronizes again
- **THEN** the existing construction-selected material object is updated in place and is not replaced with another material kind

### Requirement: Render planar lit SDF text through public TSL nodes
The planar lit variant MUST bind the production glyph position, color, clipped
SDF opacity, and shadow mask to a transparent non-metallic standard node material
using only public Three.js WebGPU and TSL surfaces.

#### Scenario: Respond to scene light
- **WHEN** front-facing lit text is rendered with and without a supported scene light
- **THEN** filled glyph regions show a measurable lighting response while intended colors, antialiased boundaries, clipped regions, and transparent exteriors remain valid

#### Scenario: Cast glyph-shaped shadows
- **WHEN** the caller enables `castShadow` and places lit text between a supported light and receiver
- **THEN** shadows follow positioned filled-glyph coverage and preserve transparent quad margins and glyph cutouts without duplicate shadow geometry

#### Scenario: Receive a scene shadow
- **WHEN** the caller enables `receiveShadow` and an external occluder shadows part of lit text
- **THEN** visible glyph-interior pixels respond to the shadow while transparent glyph-exterior pixels remain clear

#### Scenario: Render without shadow participation
- **WHEN** lit text is used with cast or receive flags disabled
- **THEN** its ordinary standard-material SDF rendering remains valid without requiring another geometry, atlas, or material path

### Requirement: Dispose only renderer-owned resources
`Text.dispose()` MUST be idempotent, invalidate pending synchronization, dispose
its geometry, material, atlas texture, and cache, and leave caller font handles,
the shared Three renderer, canvas, scene, and lower-package global state alone.

#### Scenario: Dispose a synchronized text
- **WHEN** a caller disposes a text object after one or more render and update
  cycles
- **THEN** every object-owned GPU and CPU resource is released exactly once and
  subsequent synchronization fails predictably

#### Scenario: Dispose during pending synchronization
- **WHEN** disposal occurs before pending synchronization commits
- **THEN** the pending work cannot publish a new render state or retain newly
  created object-owned resources

#### Scenario: Reuse caller resources
- **WHEN** one text object is disposed and another uses the same font handles and
  application renderer
- **THEN** the second object can synchronize and render without relying on GPU
  resources owned by the first

### Requirement: Provide independent package and actual-WebGPU evidence
The production renderer MUST remain strict-TypeScript and ESM-only, consume
completed layout through public types, import only public lower-package and
Three.js surfaces, and provide deterministic unit, package, public-example, and
semantic browser evidence for both its unlit default and planar lit variant
without a dependency on `old/`, experiment internals, WebGL, or private
font/layout/SDF modules.

#### Scenario: Install the renderer package
- **WHEN** its packed artifact is installed in a clean ESM and TypeScript consumer
  with the declared Three peer
- **THEN** public unlit and lit values and types resolve with no workspace path, CommonJS,
  browser global at module evaluation, or undeclared dependency

#### Scenario: Run deterministic non-GPU checks
- **WHEN** ordinary workspace tests execute without a browser or GPU
- **THEN** atlas packing, growth, cache reuse, synchronization, failure atomicity,
  completed-layout consumption, material selection, planar normals,
  shadow-node wiring, and disposal checks pass deterministically

#### Scenario: Run the public WebGPU fixture
- **WHEN** the documented browser fixture prepares layout through the public
  layout API and renders the production standard variant with a usable WebGPU
  adapter
- **THEN** the real-font pipeline renders multiple atlas cells, preserves color
  and transparent coverage, responds to lighting, casts and receives
  glyph-confined shadows, validates a post-render update, and repeats disposal
  on the pinned backend

#### Scenario: Reject WebGL as evidence
- **WHEN** WebGPU is unavailable or Three selects its WebGL fallback
- **THEN** browser validation fails or reports the environment unsupported and
  MUST NOT count the frame as passing renderer evidence

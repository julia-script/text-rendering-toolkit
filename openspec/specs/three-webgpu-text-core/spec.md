# three-webgpu-text-core Specification

## Purpose

Define the production resolved-input Three.js WebGPU text mesh, including
synchronization, lazy glyph rasterization, renderer-owned atlas resources,
instanced TSL rendering, interaction access, validation evidence, and disposal.

## Requirements

### Requirement: Expose a resolved-input Three text mesh
`@webgpu-text/three` SHALL expose a `Text` scene object that accepts a valid
`ResolvedLayoutInput`, a caller-owned font registry keyed by the input's font
identities, and baseline unlit appearance options without fetching font bytes or
performing automatic itemization or fallback selection.

#### Scenario: Construct resolved text
- **WHEN** a caller constructs `Text` with resolved multilingual runs and
  structurally compatible public font handles
- **THEN** the object is a Three mesh that can be added to a scene before its
  first synchronization and neither fetches nor disposes those font handles

#### Scenario: Reject an unavailable font
- **WHEN** a synchronization references a font key that is absent, disposed, or
  exposes invalid font-scale facts
- **THEN** synchronization rejects with a public renderer error before committing
  partial geometry or atlas state

### Requirement: Synchronize and update atomically
`Text.sync()` MUST return a promise, coalesce requests pending in the same work
window behind the latest captured state, and commit layout, atlas, geometry, and
material state atomically only when that request is still current.

#### Scenario: Synchronize an initial state
- **WHEN** a caller awaits `sync()` for a valid non-empty or empty resolved input
- **THEN** the promise resolves with layout result, instance count, render bounds,
  atlas contents, and appearance controls representing that captured state

#### Scenario: Coalesce rapid updates
- **WHEN** properties change and `sync()` is called repeatedly before pending work
  commits
- **THEN** the calls settle behind the newest request and no older state
  overwrites its layout, pixels, attributes, or material values

#### Scenario: Preserve a committed state after failure
- **WHEN** an update fails during validation, outline lookup, layout, or SDF
  generation
- **THEN** its promise rejects, the last successfully committed render state
  remains intact, and a later valid synchronization can succeed

### Requirement: Resolve and rasterize glyphs lazily
The renderer SHALL request an outline and generate an SDF only for a drawable
font/glyph/variation identity missing from that text object's cache, using the
resolved run's font scale to map one deterministic padded SDF view box to its
layout-space quad.

#### Scenario: Rasterize an atlas miss
- **WHEN** a positioned glyph has a drawable outline that is not cached
- **THEN** the renderer obtains the outline on demand, passes its numeric commands
  directly to `generateSdf()`, and creates an instance whose padded bounds sample
  the corresponding bitmap without an SVG or canvas conversion

#### Scenario: Reuse a repeated glyph
- **WHEN** the same font object, glyph ID, variation coordinates, and SDF settings
  occur repeatedly or in a later synchronization
- **THEN** all instances reuse one atlas slot without repeating outline extraction
  or SDF generation

#### Scenario: Ignore a non-drawing glyph
- **WHEN** a laid-out glyph has no drawable outline
- **THEN** it contributes to layout and interaction results but creates no atlas
  slot or render instance

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
- **THEN** glyph instances occupy the positions and padded bounds derived from the
  committed layout and font scale with transparent exterior and antialiased
  interior coverage

#### Scenario: Apply baseline appearance
- **WHEN** glyph style keys select different colors and the text uses opacity or
  a local clip rectangle
- **THEN** the WebGPU frame preserves per-style colors, bounded opacity blending,
  and clipping without shader-string rewriting or a WebGL-specific API

#### Scenario: Update an existing mesh
- **WHEN** a later synchronization changes text, placement, style colors,
  opacity, or clipping
- **THEN** the same public `Text` object renders the new state and does not recreate
  the application-owned renderer or canvas

### Requirement: Preserve renderer-neutral interaction results
After successful synchronization, `Text` SHALL expose the exact committed
`LayoutResult` and SHALL derive selection rectangles through the public layout
policy without copying outlines, SDF bytes, atlas slots, or Three objects into
that result.

#### Scenario: Read committed layout and selection
- **WHEN** a caller inspects the layout result and requests a valid forward,
  reversed, empty, or multiline selection after synchronization
- **THEN** the returned glyph, line, caret, bounds, and selection values match the
  public layout package for the committed input

#### Scenario: Query before synchronization
- **WHEN** a caller requests selection geometry before any successful sync
- **THEN** the operation fails predictably rather than returning provisional or
  empty renderer-derived geometry

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
The production renderer MUST remain strict-TypeScript and ESM-only, import only
public lower-package and Three.js surfaces, and provide deterministic unit,
package, public-example, and semantic browser evidence without a dependency on
`old/`, experiment internals, WebGL, or private font/layout/SDF modules.

#### Scenario: Install the renderer package
- **WHEN** its packed artifact is installed in a clean ESM and TypeScript consumer
  with the declared Three peer
- **THEN** public values and types resolve with no workspace path, CommonJS,
  browser global at module evaluation, or undeclared dependency

#### Scenario: Run deterministic non-GPU checks
- **WHEN** ordinary workspace tests execute without a browser or GPU
- **THEN** atlas packing, growth, cache reuse, synchronization, failure atomicity,
  interaction delegation, and disposal checks pass deterministically

#### Scenario: Run the public WebGPU fixture
- **WHEN** the documented browser fixture runs with a usable WebGPU adapter
- **THEN** a public real-font pipeline renders multiple atlas cells, validates a
  post-render update and semantic visual regions, and repeats disposal on the
  pinned backend

#### Scenario: Reject WebGL as evidence
- **WHEN** WebGPU is unavailable or Three selects its WebGL fallback
- **THEN** browser validation fails or reports the environment unsupported and
  MUST NOT count the frame as passing renderer evidence

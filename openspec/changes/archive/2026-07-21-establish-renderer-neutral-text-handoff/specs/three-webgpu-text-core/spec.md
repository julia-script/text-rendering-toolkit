## ADDED Requirements

### Requirement: Expose a layout-result Three text mesh
`@webgpu-text/three` SHALL expose a `Text` scene object that accepts a completed renderer-neutral `LayoutResult`, a caller-owned font registry keyed by the result's font identities, and baseline appearance options without fetching font bytes, executing text layout, deriving interaction geometry, or performing automatic itemization or fallback selection.

#### Scenario: Construct prepared text
- **WHEN** a caller constructs `Text` with a valid multilingual `LayoutResult` and structurally compatible public font handles
- **THEN** the object is a Three mesh that can be added to a scene before its first synchronization and neither fetches nor disposes those font handles

#### Scenario: Reject an unavailable font
- **WHEN** synchronization needs a drawable glyph whose font key is absent or whose lazy outline lookup fails
- **THEN** synchronization rejects with a public renderer error before committing partial geometry or atlas state

#### Scenario: Keep text policy outside Three
- **WHEN** the Three package constructs, synchronizes, updates, or disposes a text mesh
- **THEN** it does not invoke layout, shaping, selection, caret, bidi, fallback, or line-breaking operations

## MODIFIED Requirements

### Requirement: Synchronize and update atomically
`Text.sync()` MUST return a promise, coalesce requests pending in the same work window behind the latest captured state, and commit the supplied layout, atlas, geometry, and material state atomically only when that request is still current.

#### Scenario: Synchronize an initial state
- **WHEN** a caller awaits `sync()` for a valid non-empty or empty `LayoutResult`
- **THEN** the promise resolves with committed layout identity, instance count, render bounds, atlas contents, and appearance controls representing that captured state

#### Scenario: Coalesce rapid updates
- **WHEN** the layout or appearance properties change and `sync()` is called repeatedly before pending work commits
- **THEN** the calls settle behind the newest request and no older state overwrites its layout reference, pixels, attributes, or material values

#### Scenario: Preserve a committed state after failure
- **WHEN** an update fails during renderer validation, outline lookup, or SDF generation
- **THEN** its promise rejects, the last successfully committed render state remains intact, and a later valid synchronization can succeed

### Requirement: Resolve and rasterize glyphs lazily
The renderer SHALL request an outline and generate an SDF only for a drawable font/glyph/variation identity missing from that text object's cache, using the positioned glyph's `fontUnitScale` to map one deterministic padded SDF view box to its layout-space quad.

#### Scenario: Rasterize an atlas miss
- **WHEN** a positioned glyph has a drawable outline that is not cached
- **THEN** the renderer obtains the outline on demand, passes its numeric commands directly to `generateSdf()`, and scales the padded view box by the glyph's `fontUnitScale` without consulting resolved runs or font facts

#### Scenario: Reuse a repeated glyph
- **WHEN** the same font object, glyph ID, variation coordinates, and SDF settings occur repeatedly or in a later synchronization
- **THEN** all instances reuse one atlas slot without repeating outline extraction or SDF generation

#### Scenario: Ignore a non-drawing glyph
- **WHEN** a laid-out glyph has no drawable outline
- **THEN** it remains represented in the caller-owned layout result but creates no atlas slot or render instance

### Requirement: Render instanced unlit SDF text through TSL
The package MUST render one indexed unit quad per drawable glyph through instanced bounds, flat atlas slot, and normalized color attributes plus a TSL node material that provides RGBA channel selection, derivative-antialiased SDF coverage, opacity, and optional local rectangular clipping.

#### Scenario: Render positioned real-font glyphs
- **WHEN** a synchronized text mesh is rendered by the pinned Three.js `WebGPURenderer`
- **THEN** glyph instances occupy the positions and padded bounds derived solely from the supplied layout and positioned font-unit scale with transparent exterior and antialiased interior coverage

#### Scenario: Apply baseline appearance
- **WHEN** glyph style keys select different colors and the text uses opacity or a local clip rectangle
- **THEN** the WebGPU frame preserves per-style colors, bounded opacity blending, and clipping without shader-string rewriting or a WebGL-specific API

#### Scenario: Update an existing mesh
- **WHEN** a later synchronization supplies another completed layout or changes style colors, opacity, or clipping
- **THEN** the same public `Text` object renders the new state and does not recreate the application-owned renderer or canvas

### Requirement: Provide independent package and actual-WebGPU evidence
The production renderer MUST remain strict-TypeScript and ESM-only, consume completed layout through public types, import only public lower-package and Three.js surfaces, and provide deterministic unit, package, public-example, and semantic browser evidence without a dependency on `old/`, experiment internals, WebGL, or private font/layout/SDF modules.

#### Scenario: Install the renderer package
- **WHEN** its packed artifact is installed in a clean ESM and TypeScript consumer with the declared Three peer
- **THEN** public values and types resolve with no workspace path, CommonJS, browser global at module evaluation, or undeclared dependency

#### Scenario: Run deterministic non-GPU checks
- **WHEN** ordinary workspace tests execute without a browser or GPU
- **THEN** atlas packing, growth, cache reuse, synchronization, failure atomicity, completed-layout consumption, and disposal checks pass deterministically

#### Scenario: Run the public WebGPU fixture
- **WHEN** the documented browser fixture prepares layout through the public layout API and renders it with a usable WebGPU adapter
- **THEN** the real-font pipeline renders multiple atlas cells, validates a post-render layout update and semantic visual regions, and repeats disposal on the pinned backend

#### Scenario: Reject WebGL as evidence
- **WHEN** WebGPU is unavailable or Three selects its WebGL fallback
- **THEN** browser validation fails or reports the environment unsupported and MUST NOT count the frame as passing renderer evidence

## REMOVED Requirements

### Requirement: Expose a resolved-input Three text mesh
**Reason**: The renderer-neutral boundary moves from pre-layout `ResolvedLayoutInput` to completed `LayoutResult`, so Three no longer owns layout execution or requires font facts for scale recovery.

**Migration**: Call `layoutResolvedText(input)` in the application or layout layer, then construct `Text` with `{ layout, fonts }`.

### Requirement: Preserve renderer-neutral interaction results
**Reason**: Carets, selections, and future hit testing are text-layout policy and should not be calculated or delegated by a renderer adapter.

**Migration**: Retain the prepared `LayoutResult` and call `getSelectionRects(layout, range)` directly from `@webgpu-text/layout`.

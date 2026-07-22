## ADDED Requirements

### Requirement: Expose reusable text renderer resources
`@webgpu-text/three` SHALL expose an explicit `TextResources` owner that can be supplied to multiple `Text` objects while keeping its cache, atlas representation, Three texture, and renderer bindings opaque.

#### Scenario: Share resources across text objects
- **WHEN** a caller constructs one `TextResources` and supplies it to two or more text objects
- **THEN** those objects borrow the same glyph resources while retaining independent layout, geometry, material, appearance, synchronization, and disposal state

#### Scenario: Keep standalone construction convenient
- **WHEN** a caller constructs `Text` without supplying shared resources
- **THEN** the text creates private resources using its requested or default SDF size and owns their eventual disposal

#### Scenario: Reject ambiguous raster configuration
- **WHEN** a caller supplies both an existing `TextResources` and a text-level SDF size
- **THEN** construction rejects with a public renderer error rather than silently selecting one configuration

#### Scenario: Keep representation details private
- **WHEN** a caller uses `TextResources` through the public package API
- **THEN** the caller does not need access to SDF pixels, RGBA channel packing, atlas slots, texture dimensions, or TSL bindings
- **AND** the owner does not acquire fonts, execute layout, or dispose caller-owned font handles

## MODIFIED Requirements

### Requirement: Synchronize and update atomically
`Text.sync()` MUST return a promise, coalesce requests pending in the same work
window behind the latest captured state, and commit the supplied layout,
resource plan, geometry, and material state atomically only when that request is
still current.

#### Scenario: Synchronize an initial state
- **WHEN** a caller awaits `sync()` for a valid non-empty or empty `LayoutResult`
- **THEN** the promise resolves with committed layout identity, instance count,
  render bounds, resource contents, and appearance controls representing that
  captured state

#### Scenario: Coalesce rapid updates
- **WHEN** the layout or appearance properties change and `sync()` is called
  repeatedly before pending work commits
- **THEN** the calls settle behind the newest request and no older state
  overwrites its layout reference, resource pixels, attributes, or material values

#### Scenario: Preserve committed state after failure
- **WHEN** an update fails during renderer validation, outline lookup, or SDF
  generation
- **THEN** its promise rejects, neither its planned shared-resource additions nor
  its text state commit partially, the last successfully committed render state
  remains intact, and a later valid synchronization can succeed

#### Scenario: Coordinate independent shared-resource updates
- **WHEN** separate text objects synchronize atlas misses against the same
  `TextResources`
- **THEN** each synchronous commit observes the latest resource state, preserves
  existing slot identities, and cannot overwrite additions committed by the
  other object

### Requirement: Resolve and rasterize glyphs lazily
The renderer SHALL request an outline and generate an SDF only for a drawable
font/glyph/variation identity missing from the selected `TextResources` cache,
using the positioned glyph's `fontUnitScale` to map one deterministic padded SDF
view box to its layout-space quad.

#### Scenario: Rasterize a resource miss
- **WHEN** a positioned glyph has a drawable outline that is not cached by the
  selected resources
- **THEN** the renderer obtains the outline on demand, passes its numeric commands
  directly to `generateSdf()`, and scales the padded view box by the glyph's
  `fontUnitScale` without consulting resolved runs or font facts

#### Scenario: Reuse a repeated glyph within one text
- **WHEN** the same font object, glyph ID, variation coordinates, and SDF settings
  occur repeatedly or in a later synchronization of one text
- **THEN** all instances reuse one resource slot without repeating outline
  extraction or SDF generation

#### Scenario: Reuse a repeated glyph across texts
- **WHEN** two text objects use the same `TextResources`, font object, glyph ID,
  variation coordinates, and SDF settings
- **THEN** both geometries address one stable atlas slot and the second object
  does not repeat outline extraction or SDF generation

#### Scenario: Distinguish separate font handles
- **WHEN** equivalent font bytes were loaded into separate font-handle objects
- **THEN** the resources treat their glyph identities as distinct unless the
  caller reuses one handle object

#### Scenario: Ignore a non-drawing glyph
- **WHEN** a laid-out glyph has no drawable outline
- **THEN** it remains represented in the caller-owned layout result, creates no
  atlas slot or render instance, and its empty identity can be reused without
  repeating outline work

### Requirement: Own an RGBA glyph atlas
Each `TextResources` SHALL own deterministic flat-slot allocation, RGBA channel
packing, byte storage, growth, dirty texture upload, cache lifetime, shared
atlas-dimension state, and texture disposal without exposing atlas policy
through the SDF or layout packages. A text without injected resources SHALL own
one private `TextResources` instance.

#### Scenario: Pack slots across cells and channels
- **WHEN** five or more distinct drawable glyphs are synchronized into one
  resource owner
- **THEN** slots zero through three occupy separate channels of the first cell and
  later slots occupy subsequent cells without channel contamination

#### Scenario: Grow a shared atlas
- **WHEN** one text adds a glyph beyond the shared atlas's current slot capacity
- **THEN** the owner expands the atlas, preserves every existing cell byte and
  slot identity, refreshes the stable bound Three texture and shared dimensions,
  and renders old and new glyphs correctly

#### Scenario: Keep existing borrowers valid after growth
- **WHEN** a text has rendered successfully and another borrower later grows
  their shared atlas
- **THEN** the earlier text samples its original stable slots using the new atlas
  dimensions without requiring another text synchronization

#### Scenario: Upload a dirty shared atlas
- **WHEN** synchronization packs one or more new bitmaps after an earlier rendered
  frame
- **THEN** the next WebGPU frame for every borrower observes the complete updated
  atlas while cached slots remain stable

### Requirement: Dispose only renderer-owned resources
`Text.dispose()` MUST be idempotent, invalidate pending synchronization, dispose
its geometry and material, dispose resources only when the text created its
private default, and leave injected `TextResources`, caller font handles, the
shared Three renderer, canvas, scene, and lower-package global state alone.
`TextResources.dispose()` MUST be idempotent and release its owned texture and
cache independently of borrowed text objects.

#### Scenario: Dispose a text with private resources
- **WHEN** a caller disposes a privately backed text after one or more render and
  update cycles
- **THEN** its geometry, material, private texture, and private cache are released
  exactly once and subsequent synchronization fails predictably

#### Scenario: Dispose one shared borrower
- **WHEN** a caller disposes one text using injected resources while another text
  uses the same owner
- **THEN** only the disposed text's geometry and material are released and the
  other text can continue to synchronize and render from the shared cache and
  texture

#### Scenario: Dispose during pending synchronization
- **WHEN** text disposal occurs before pending synchronization commits
- **THEN** the pending work cannot publish a new text state or resource plan

#### Scenario: Dispose shared resources after borrowers
- **WHEN** the caller disposes all borrowing texts and then disposes their shared
  `TextResources`
- **THEN** the shared texture and CPU cache are released exactly once without
  disposing caller font handles, renderer, or canvas

#### Scenario: Reject use after shared-resource disposal
- **WHEN** a text attempts to synchronize after its injected resources have been
  disposed
- **THEN** synchronization rejects with a stable public renderer error and does
  not publish a new render state

### Requirement: Provide independent package and actual-WebGPU evidence
The production renderer MUST remain strict-TypeScript and ESM-only, consume
completed layout through public types, import only public lower-package and
Three.js surfaces, and provide deterministic unit, package, public-example, and
semantic browser evidence for private and shared resources with both its unlit
default and planar lit variant, without a dependency on `old/`, experiment
internals, WebGL, or private font/layout/SDF modules.

#### Scenario: Install the renderer package
- **WHEN** its packed artifact is installed in a clean ESM and TypeScript consumer
  with the declared Three peer
- **THEN** public `TextResources`, private and shared text construction, unlit and
  lit values, and their types resolve with no workspace path, CommonJS, browser
  global at module evaluation, or undeclared dependency

#### Scenario: Run deterministic non-GPU checks
- **WHEN** ordinary workspace tests execute without a browser or GPU
- **THEN** private and shared atlas packing, growth, cross-object cache reuse,
  synchronization, failure atomicity, completed-layout consumption, material
  selection, shared growth propagation, planar normals, shadow-node wiring, and
  separate text/resource disposal checks pass deterministically

#### Scenario: Run the public WebGPU fixture
- **WHEN** the documented browser fixture prepares layout through the public
  layout API and renders multiple production text objects sharing resources with
  a usable WebGPU adapter
- **THEN** repeated real-font glyphs reuse shared slots, one object can grow the
  atlas without resynchronizing an earlier object, multiple atlas cells preserve
  color and transparent coverage, the standard variant responds to lighting and
  glyph-confined shadows, post-render updates remain valid, and repeated
  text-then-resource disposal succeeds on the pinned backend

#### Scenario: Reject WebGL as evidence
- **WHEN** WebGPU is unavailable or Three selects its WebGL fallback
- **THEN** browser validation fails or reports the environment unsupported and
  MUST NOT count the frame as passing renderer evidence

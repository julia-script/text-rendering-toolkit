# three-webgpu-text-core Specification

## Purpose

Define the production renderer-neutral-layout Three.js WebGPU text mesh,
including synchronization, lazy glyph rasterization, renderer-owned atlas
resources, instanced TSL rendering, validation evidence, and disposal.

## Requirements

### Requirement: Expose a layout-result Three text mesh
`@text-rendering-toolkit/three-webgpu` SHALL expose a `Text` scene object that accepts a completed
renderer-neutral `LayoutResult`, a caller-owned font registry keyed by the
result's font identities, and baseline appearance options without fetching font
bytes, executing text layout, deriving interaction geometry, or performing
automatic itemization or fallback selection. Construction MUST establish that
the supplied options are a non-null object before reading any option from them,
and MUST report a non-object argument with a public renderer error.

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

#### Scenario: Reject non-object construction options
- **WHEN** a caller constructs `Text` with `null`, `undefined`, or a primitive in
  place of an options object
- **THEN** construction throws `InvalidTextInputError` and no option is read from
  the argument

#### Scenario: Reject construction options whose property access throws
- **WHEN** a caller constructs `Text` with an options object whose property access
  throws, such as a throwing getter or a `Proxy` trap
- **THEN** construction throws `InvalidTextInputError` rather than propagating the
  caller's error, and each option is read at most once

### Requirement: Expose reusable text renderer resources
`@text-rendering-toolkit/three-webgpu` SHALL expose an explicit `TextResources` owner that can be supplied to multiple `Text` objects while keeping its cache, atlas representation, Three texture, and renderer bindings opaque. Construction MUST establish that the supplied options are a non-null object before reading any option from them, and MUST report a non-object argument with a public renderer error.

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

#### Scenario: Reject non-object resource options
- **WHEN** a caller constructs `TextResources` with `null` or a primitive in place of an options object
- **THEN** construction throws `InvalidTextInputError` and no option is read from the argument
- **AND** omitting the argument entirely remains valid, since the options parameter defaults to an empty object

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
`@text-rendering-toolkit/three-webgpu` SHALL let a caller choose the existing unlit material or one
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

### Requirement: Compose optional COLR v0 layers after layout
`@text-rendering-toolkit/three-webgpu` SHALL optionally consume the font boundary's lazy ordered color layers for each final positioned glyph, render each drawable layer at the base glyph's unchanged position and scale, and preserve the supplied `LayoutResult` as the committed renderer-neutral identity.

#### Scenario: Render a layered color glyph
- **WHEN** a positioned glyph's structural font exposes valid ordered COLR v0 layers
- **THEN** synchronization resolves only those layer outlines, creates ordered render instances at the base placement, applies their CPAL colors, and leaves the original layout glyph, line, caret, selection, and bounds data unchanged

#### Scenario: Resolve current foreground from appearance
- **WHEN** a color layer uses the current-foreground marker
- **THEN** its instance uses the base glyph's effective `styleColors` entry or default text color and responds to a later appearance synchronization without duplicating its SDF resource

#### Scenario: Preserve monochrome fallback
- **WHEN** the structural font omits color lookup, returns `null`, or the selected glyph has no supported color layers
- **THEN** the renderer follows the existing single-outline SDF path with its accepted appearance and cache behavior

### Requirement: Reuse layer SDF resources without color duplication
`TextResources` MUST key each drawable layer's SDF by the existing font object, layer glyph ID, canonical variations, and SDF settings, while keeping CPAL and foreground colors as per-instance RGBA appearance so color changes do not duplicate identical scalable SDF pixels.

#### Scenario: Reuse repeated and shared color glyphs
- **WHEN** repeated color glyphs or separate texts sharing one `TextResources` resolve the same font object and layer identities
- **THEN** every repeated layer reuses its stable existing atlas slot without repeating layer lookup, outline extraction, or SDF generation

#### Scenario: Change foreground without duplicating SDFs
- **WHEN** a current-foreground layer is synchronized with a different default or per-style color
- **THEN** the instance RGBA changes while its font/layer/variation/SDF identity continues to address the same atlas slot

#### Scenario: Keep separate font objects distinct
- **WHEN** equivalent COLR v0 bytes are loaded into separate font-handle objects
- **THEN** their layer SDF identities remain separate unless the caller shares one handle object

### Requirement: Preserve atomic color synchronization and ownership
Color-layer resolution, layer outline/SDF planning, instance RGBA assembly, and atlas changes MUST participate in the existing atomic `Text.sync()` and private/shared `TextResources` lifecycle without transferring ownership of caller fonts, renderer, canvas, or layout.

#### Scenario: Reject malformed color resolution atomically
- **WHEN** an update encounters malformed color data, an invalid layer result, or a failing layer outline after a previously accepted state
- **THEN** synchronization rejects with a public renderer error, commits no partial color resources or instances, preserves the last accepted state, and permits a later valid synchronization

#### Scenario: Dispose color-backed text and resources
- **WHEN** color-backed private or shared texts and their resource owner are disposed in the documented order
- **THEN** disposal remains idempotent, releases only renderer-owned geometry, material, texture, and cache state, and leaves caller-owned fonts and Three infrastructure untouched

### Requirement: Render COLR v0 RGBA through actual WebGPU
The unlit and planar-lit material variants MUST carry normalized per-instance RGBA, multiply layer alpha by text opacity and clipping coverage, preserve transparent exteriors and layer order, and render through the pinned Three `WebGPURenderer` without WebGL or shader-string rewriting.

#### Scenario: Render mixed monochrome and color text
- **WHEN** the accepted mixed styled line is synchronized and rendered on an actual WebGPU adapter
- **THEN** semantic pixels show ordinary monochrome SDF text, intrinsic COLR colors, current-foreground color, bounded alpha, transparent exterior, and placement consistent with the unchanged layout

#### Scenario: Render representative sizes and material variants
- **WHEN** accepted color glyphs are rendered at two layout sizes through unlit and planar-lit text
- **THEN** their scalable layer SDFs preserve relative placement and visible colors while the lit variant retains the existing supported light and shadow behavior

#### Scenario: Consume the packed package boundary
- **WHEN** a clean ESM consumer installs the packed font, layout, SDF, and Three packages
- **THEN** it can shape, lay out, synchronize, update, and dispose mixed COLR v0 and monochrome text using only public exports and caller-supplied bytes

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

### Requirement: Reserve configurable em-based SDF paint padding
Each `TextResources` MUST reserve a finite positive, construction-fixed SDF padding distance in em units for every drawable glyph, using the caller font's `facts.unitsPerEm`, independently of that glyph's ink extent and with a documented default of `0.125em`.

#### Scenario: Frame different glyph extents consistently
- **WHEN** one resource owner rasterizes a wide letter, punctuation mark, combining mark, or narrow script glyph from fonts exposing valid units per em
- **THEN** every bitmap represents the same configured em padding before `fontUnitScale` maps it into that glyph's layout size

#### Scenario: Configure additional paint reserve
- **WHEN** a caller constructs `TextResources` with a larger valid `sdfPadding`
- **THEN** subsequently generated glyphs reserve the larger em distance while `sdfSize` independently continues to control cell resolution

#### Scenario: Reject invalid resource padding or font facts
- **WHEN** resource padding is non-finite or non-positive, or a required font exposes invalid `facts.unitsPerEm`
- **THEN** construction or synchronization rejects with a public renderer error before committing resource or text state

### Requirement: Expose ordinary-glyph outline and one drop shadow
`@text-rendering-toolkit/three-webgpu` SHALL expose optional mutable appearance for one outer glyph outline and one offset, softened visual drop shadow, with independent color and opacity, while keeping both effects disabled by default and committed only through `Text.sync()`.

#### Scenario: Preserve existing defaults
- **WHEN** a caller constructs and synchronizes text without outline or shadow appearance
- **THEN** the existing fill, opacity, clipping, material kind, layout identity, and resource behavior remain unchanged

#### Scenario: Render outline and shadow together
- **WHEN** a caller supplies a finite non-negative outline width, signed shadow offsets, finite non-negative shadow softness, valid independent colors and bounded opacities, then awaits synchronization
- **THEN** ordinary glyphs compose the visual shadow beneath the outer outline and fill in both unlit and planar-lit material variants

#### Scenario: Interpret paint in layout units
- **WHEN** one layout contains ordinary glyphs with different fonts or font-unit scales
- **THEN** outline width, shadow offset, and shadow softness are interpreted in the same layout coordinate system as font size and glyph positions rather than as public atlas texels or normalized SDF thresholds

#### Scenario: Update appearance without replacing renderer objects
- **WHEN** a caller changes only outline or shadow appearance and synchronizes again
- **THEN** the same public text, geometry, material, layout result, and selected resource owner remain in use while the captured appearance updates atomically

### Requirement: Reuse one ordinary-glyph SDF for composed paint
The renderer MUST derive fill, outline, and one drop shadow for an ordinary drawable glyph by sampling its existing encoded distance field and stable atlas slot, with appearance values excluded from outline lookup, SDF generation, cache identity, and slot allocation.

#### Scenario: Repaint a cached glyph
- **WHEN** a synchronized ordinary glyph receives different fill, outline, or shadow colors or supported distance controls
- **THEN** it retains the same outline lookup result, SDF pixels, texture identity, and atlas slot without another glyph-resource insertion

#### Scenario: Preserve shared-borrower reuse
- **WHEN** independent unlit or planar-lit texts borrow one `TextResources` and render the same ordinary glyph with different supported outline or shadow appearance
- **THEN** both texts address one shared glyph resource while retaining independent material controls and render bounds

#### Scenario: Compose source-over paint
- **WHEN** antialiased shadow, outline, and fill coverage overlap with independent opacities
- **THEN** the renderer composes them in shadow-outline-fill order without opaque halos or changing the text's final uniform opacity semantics

#### Scenario: Preserve scene-shadow meaning
- **WHEN** planar-lit text uses visual drop shadow appearance and also enables ordinary Three.js cast-shadow behavior
- **THEN** fill and outline contribute glyph-shaped visible and scene-shadow coverage while the visual drop shadow does not become a second offset scene-shadow caster

### Requirement: Validate SDF paint extent atomically
The renderer MUST validate every captured ordinary-glyph paint request against the safely encodable portion of the selected resource padding before committing renderer or shared-resource state, using the maximum of outline width, horizontal shadow offset plus softness, and vertical shadow offset plus softness, plus one antialias texel after per-glyph layout-to-SDF conversion. The safely encodable portion MUST account for the nonlinear exponent, eight-bit quantization, and the material's minimum encoded antialias width so accepted paint cannot reveal the clamped square SDF cell background.

#### Scenario: Accept paint within padding
- **WHEN** the converted paint extent fits every affected ordinary glyph's reserved SDF padding
- **THEN** synchronization commits the appearance, resource plan, material controls, geometry, and bounds together

#### Scenario: Reject excessive paint
- **WHEN** any affected ordinary glyph requires more paint extent than its SDF padding represents
- **THEN** synchronization rejects with required and available extent information and identifies `sdfPadding` as the physical reserve control before material, geometry, layout-result, atlas pixels, texture identity, or stable slots mutate

#### Scenario: Recover after rejected paint
- **WHEN** a text has a committed frame, rejects an excessive outline or shadow request, and later synchronizes supported appearance
- **THEN** the rejected request leaves the prior frame intact and the later request succeeds on the same text and resource owner

#### Scenario: Reject malformed appearance
- **WHEN** outline or shadow appearance contains a non-finite distance, negative width or softness, invalid color, or opacity outside zero through one
- **THEN** synchronization rejects with a public renderer error before any state commit

### Requirement: Bound and clip composed glyph paint
The renderer SHALL keep supported outline and drop-shadow samples inside the existing padded glyph quad, expand renderer-owned bounds by the accepted outer and directional paint extents, and apply the existing local clip rectangle to the final composed result without modifying renderer-neutral layout geometry.

#### Scenario: Expand directional bounds
- **WHEN** ordinary glyphs render an outline or an offset softened shadow
- **THEN** committed geometry bounds include the outline on all sides and the shadow on the sides reached by its signed offset and softness while `LayoutResult.blockBounds`, lines, carets, and selections remain unchanged

#### Scenario: Clip the composed result
- **WHEN** a clip rectangle intersects fill, outline, or shadow pixels
- **THEN** all three layers are clipped at the same final layout-space boundary with transparent pixels outside it

#### Scenario: Avoid packed-cell contamination
- **WHEN** accepted paint reaches the edge of its usable SDF distance
- **THEN** sampling stays within that glyph's padded atlas cell and does not expose another cell or RGBA channel

### Requirement: Keep COLR outline and shadow explicitly deferred
The first production outline and drop-shadow increment MUST apply those effects only to ordinary glyph instances and MUST preserve existing COLR v0 layer composition without independently outlining or shadowing its layers.

#### Scenario: Render mixed ordinary and COLR text
- **WHEN** one synchronized layout contains ordinary glyphs and COLR v0 glyphs while outline or shadow appearance is enabled
- **THEN** ordinary glyphs receive the effect, COLR layers retain their existing palette/current-foreground paint and ordering, and the mixed text remains valid

#### Scenario: Avoid false padding failure for COLR-only paint
- **WHEN** a layout contains only COLR layers or blank glyphs and ordinary-glyph effects are configured
- **THEN** those ineligible instances do not cause an excessive-paint rejection or acquire paint-specific resources

### Requirement: Prove production SDF paint through public WebGPU paths
The package MUST provide deterministic, packed-consumer, documentation-example, and actual-WebGPU evidence for ordinary-glyph outline and one drop shadow through public APIs in both existing material variants, without importing private experiment code or adding WebGL evidence.

#### Scenario: Validate deterministic production behavior
- **WHEN** ordinary package tests run without a GPU
- **THEN** defaults, input and extent validation, distance conversion, source-over controls, bounds, clipping, cache and slot reuse, shared borrowers, atomic recovery, COLR coexistence, and disposal pass deterministically

#### Scenario: Consume the packed public API
- **WHEN** a clean strict-TypeScript ESM consumer installs the packed package and uses outline and shadow appearance
- **THEN** the new records, constructor options, mutable fields, synchronization, and disposal resolve using only declared public dependencies

#### Scenario: Observe paint on actual WebGPU
- **WHEN** a public fixture renders real ordinary Latin and Arabic glyphs with independent fill, outline, and shadow colors through shared unlit and planar-lit texts
- **THEN** semantic pixels show the expected ordered regions, antialiasing, transparency, bounds, and clipping while resource observations retain stable texture and slot identities across appearance updates

#### Scenario: Observe rejection and cleanup on actual WebGPU
- **WHEN** the fixture requests excessive paint after a valid frame, recovers with supported paint, and repeatedly disposes texts and resources
- **THEN** the prior frame survives rejection, recovery renders correctly, and renderer-owned GPU resources are released without disposing caller-owned fonts or the application renderer

### Requirement: Render depth-ink text in two deduplicated passes
`Text` SHALL accept a boolean `depthInk` construction option, fixed at construction and defaulting to `false`. With `depthInk: false` or omitted, rendering behavior is byte-for-byte the existing single transparent pass. With `depthInk: true`, the mesh MUST render its glyph instances in two passes over one shared instanced geometry: a core pass covering fragments whose fill coverage inside the clip rectangle is at least one half, drawn at the flat string opacity, writing the depth buffer under a less-than depth comparison, and discarding non-ink fragments via alpha test so they never write depth; and an edge pass covering all remaining visible fragments — the antialiasing ring, outline, and shadow — blended without depth writes. Core membership MUST be decided on fill coverage alone, never on coverage composed with outline or shadow, so outline ramps and soft shadow interiors retain their gradients. Both passes MUST honor the same appearance state (`opacity`, `clipRect`, outline, shadow) committed by a single `sync()`.

#### Scenario: Overlapping ink blends once at partial opacity
- **WHEN** a `depthInk: true` text with opacity strictly between 0 and 1 renders glyphs whose ink overlaps, such as a connected script or tightly kerned pair
- **THEN** every pixel covered by fully-covered fill ink from more than one glyph reaches exactly the flat string opacity, with no darker seam where the glyphs overlap

#### Scenario: Depth-ink text occludes geometry behind it
- **WHEN** a `depthInk: true` text renders in front of other depth-tested geometry at greater depth
- **THEN** fragments of that geometry behind fully-covered fill ink fail the depth test, while fragments behind the text's non-ink regions render normally

#### Scenario: Antialiasing ring and effects stay soft
- **WHEN** a `depthInk: true` text renders with an outline or a soft shadow
- **THEN** the antialiasing ring, outline ramp, and shadow gradient blend with their partial coverage values rather than being flattened to the core opacity, and are not occluded by the text's own core ink at equal depth beyond the core's exact pixels

#### Scenario: Default construction is unchanged
- **WHEN** a caller constructs `Text` without `depthInk` or with `depthInk: false`
- **THEN** the mesh renders in the existing single transparent non-depth-writing pass with identical output to the prior release

#### Scenario: Reject the unlit-only combination
- **WHEN** a caller constructs `Text` with both `depthInk: true` and `lit: true`
- **THEN** construction throws `InvalidTextInputError` naming the unsupported combination

#### Scenario: One sync commits both passes
- **WHEN** a caller assigns appearance or layout properties on a `depthInk: true` text and awaits one `sync()`
- **THEN** both passes render the committed state consistently — neither pass can present a newer layout, opacity, clip, or effect state than the other

#### Scenario: Disposal releases both passes
- **WHEN** a caller disposes a `depthInk: true` text
- **THEN** the geometry and the materials of both passes are released exactly once, and shared `TextResources` remain usable by other borrowers

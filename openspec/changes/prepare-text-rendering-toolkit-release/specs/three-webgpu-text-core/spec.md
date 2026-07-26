## MODIFIED Requirements

### Requirement: Expose a layout-result Three text mesh
`@text-rendering-toolkit/three-webgpu` SHALL expose a `Text` scene object that accepts a completed
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

### Requirement: Expose reusable text renderer resources
`@text-rendering-toolkit/three-webgpu` SHALL expose an explicit `TextResources` owner that can be supplied to multiple `Text` objects while keeping its cache, atlas representation, Three texture, and renderer bindings opaque.

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

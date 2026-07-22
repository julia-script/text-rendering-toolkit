## ADDED Requirements

### Requirement: Compose optional COLR v0 layers after layout
`@webgpu-text/three` SHALL optionally consume the font boundary's lazy ordered color layers for each final positioned glyph, render each drawable layer at the base glyph's unchanged position and scale, and preserve the supplied `LayoutResult` as the committed renderer-neutral identity.

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

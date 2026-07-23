## ADDED Requirements

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
`@webgpu-text/three` SHALL expose optional mutable appearance for one outer glyph outline and one offset, softened visual drop shadow, with independent color and opacity, while keeping both effects disabled by default and committed only through `Text.sync()`.

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

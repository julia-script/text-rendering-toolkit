## Context

The Three package renders one padded, single-channel SDF cell per ordinary outline, packs four cells into each RGBA atlas square, and turns the selected channel into antialiased fill coverage in a shared TSL node assembly. `Text.sync()` already snapshots mutable appearance, builds a non-mutating resource plan, and commits geometry, atlas, and material state only after validation succeeds. Unlit and planar-lit text share that assembly; the lit material additionally derives its scene-shadow mask from glyph coverage.

The completed browser-decoration validation demonstrated fill, outline, and one offset/softened drop shadow from one unchanged 64 × 64 SDF texture in actual WebGPU. It also established a hard boundary: requested paint plus one antialias texel must fit the SDF's padding, excessive paint must reject before mutation, and a composed COLR v0 silhouette is not equivalent to independently outlining every layer. Production investigation found that the old padding was proportional to each glyph's ink extent, so increasing `sdfSize` improved resolution but did not increase usable paint distance and small punctuation could reject modest fixed-width paint. The production resource contract therefore needs one explicit em-based padding value.

## Goals / Non-Goals

**Goals:**

- Add one outer outline and one visual drop shadow to ordinary glyphs in both existing material variants.
- Keep both effects as mutable appearance that commits through `Text.sync()` without changing layout or resource identity.
- Express public distances in layout units, independent colors through Three color values plus opacity, and disabled states explicitly.
- Reuse the current atlas texture, slot, SDF bytes, and lazy-outline cache across appearance changes and shared borrowers.
- Reserve consistent configurable em-based SDF padding, reject invalid or unsupported extents atomically, and report enough information for a caller to select appropriate `TextResources`.
- Keep geometry bounds, clipping, documentation, packed consumption, and actual-WebGPU evidence honest about the composed paint.

**Non-Goals:**

- Multiple outlines or shadow stacks, inner strokes, Gaussian blur, arbitrary filters, gradients, shader rewriting, or custom-material derivation.
- Layout-owned paint, per-style outline/shadow maps, raw-text processing, interaction changes, or new SDF-package APIs.
- COLR v0 composed-silhouette outline or shadow, COLR v1, bitmap/SVG color glyphs, or automatic raster regeneration for excessive paint.
- Runtime switching between unlit and lit material kinds or changing the existing scene-light and shadow-map ownership model.

## Decisions

### Expose two nullable appearance records in layout units

Add public records equivalent to:

```ts
interface TextOutline {
  readonly width: number
  readonly color: ColorRepresentation
  readonly opacity?: number
}

interface TextShadow {
  readonly offsetX: number
  readonly offsetY: number
  readonly softness: number
  readonly color: ColorRepresentation
  readonly opacity?: number
}
```

`TextOptions` gains optional `outline` and `shadow` values, and `Text` exposes the corresponding mutable fields as `TextOutline | null` and `TextShadow | null`. Omission and `null` disable the effect. Width and softness are finite non-negative layout units; offsets are signed finite layout units; colors follow the existing finite Three color validation; opacity defaults to `1` and must remain in `[0, 1]`. `sync()` copies each record so later object mutation cannot alter the captured request.

Layout units match the existing `LayoutResult`: an outline width of `1` has the same scale as a font size or glyph position of `1`. This produces predictable CSS-like fixed paint across mixed font sizes while keeping atlas texels private. Alternative: expose SDF-pixel or normalized thresholds. Rejected because the same value would change visible size with `sdfSize`, glyph bounds, or font scale. Alternative: add seven flat fields. Rejected because nullable records give an unambiguous disabled state and keep one shadow's values together without introducing a general effect system.

### Reserve fixed em-based padding in each resource owner

`TextResourcesOptions` gains `sdfPadding`, a finite positive distance in em units, defaulting to `0.125`. `TextResources` exposes the selected value as a construction-fixed readonly field. The structural `TextFont` contract requires the already-public `facts.unitsPerEm` value; real `FontHandle` objects satisfy it directly. SDF generation frames every drawable outline with `facts.unitsPerEm * sdfPadding` font units on all sides and uses that value as the encoded maximum distance.

This makes usable paint distance `fontSize * sdfPadding` after applying `fontUnitScale`, independent of whether the glyph is a wide letter, period, mark, or narrow Arabic form. `sdfSize` continues to control texel resolution, while `sdfPadding` controls physical reserve; increasing one no longer falsely claims to do the other's job. Because both values are fixed for a resource owner, its internal cache key needs no per-glyph paint value and separate owners remain isolated.

Alternative: retain ink-relative padding and document punctuation failures. Rejected because it makes fixed layout-unit paint inconsistent across characters. Alternative: frame resources from the current outline/shadow request. Rejected because appearance would enter generation and cache identity. Alternative: add font size to `PositionedGlyph`. Rejected because `facts.unitsPerEm` already exists on caller-owned fonts and avoids changing the renderer-neutral layout handoff.

### Convert appearance per ordinary glyph without changing its resource key

Resource identity remains font-handle identity, outline glyph ID, canonical variations, SDF size, and the owning resources' fixed em padding. Each planned ordinary glyph additionally carries renderer-internal distance metadata from its padded bitmap, fixed SDF exponent, and `fontUnitScale`; this metadata is not part of per-glyph paint identity. Instance data gains only the minimum paint-eligibility/distance values needed by TSL.

For each ordinary glyph, the material samples its existing atlas channel at the current UV for fill and outline, then samples that same channel again at a UV shifted by the shadow offset. Encoded distance thresholds are derived from requested layout distance and that instance's maximum represented distance rather than treating nonlinear encoded bytes as linear physical units. The composition order is shadow, outer outline, then fill, with straight-alpha source-over behavior; the text's existing uniform opacity applies to the result. Outline width extends outward from the fill edge, and shadow softness is an SDF falloff rather than a Gaussian convolution.

Alternative: generate or cache paint-specific bitmaps. Rejected because color, width, offset, and softness do not change the outline distance field and would duplicate CPU work, atlas slots, uploads, and shared memory. Alternative: add a second mesh or draw call for the shadow. Rejected for this single bounded effect because a second sample in the existing node material preserves one mesh, one material, one geometry, and the proven resource path.

### Use the existing padded quad and expand semantic render bounds

The current glyph quad covers the entire padded SDF cell. Accepted paint is therefore guaranteed to fit inside that quad; geometry does not need duplicated fill/shadow instances or stretched UVs. The renderer computes its committed/bounding box from the unchanged layout block bounds expanded by outline width and by the shadow's directional offset plus softness, including the antialias margin used during validation. `LayoutResult.blockBounds`, lines, carets, selections, and measurement remain unchanged.

The existing `clipRect` is evaluated at the final fragment position and clips fill, outline, and shadow together. The visual drop shadow is paint, not a second scene object. For planar-lit text, fill and outline participate in the existing visible surface and glyph-shaped scene-shadow mask; the visual drop shadow is excluded from that mask so enabling `castShadow` does not create a shadow of a shadow. Unlit behavior is unchanged when both records are null.

Alternative: enlarge quads past the SDF cell. Rejected because supported paint already fits the reserved padding and sampling outside a cell risks adjacent packed-cell contamination.

### Validate every captured request before any commit

Validation occurs during the existing build phase, before geometry attributes, material uniforms, atlas contents, or `layoutResult` mutate. For every effect-eligible drawable glyph, convert the requested distances to SDF texels using its padded view box and `fontUnitScale`, then require:

```text
required padding = max(outline width,
                       abs(shadow offset x) + softness,
                       abs(shadow offset y) + softness)
                   + 1 antialias texel
```

The request is accepted only when the required value fits the safely encodable part of the resource's reserved padding for every eligible glyph. Because the nonlinear field is quantized to eight bits and material antialiasing has a minimum encoded width of `1 / 255`, the safe physical limit is `maximumDistance * (1 - (2 / 255) ** (1 / exponent))`; accepting paint beyond it would reveal the clamped square cell background even before reaching the nominal maximum distance. A rejection names the required and safely encodable extent and recommends a larger `TextResources({ sdfPadding })`; increasing `sdfSize` is recommended only when the physical antialias texel itself is the limiting term. It never clamps, regenerates, or partially updates. Empty layouts, blank glyphs, disabled/fully transparent effects, and COLR-only layers do not create false failures. A later valid sync must recover on the same object and shared resources.

Alternative: clamp to available distance. Rejected because visible width would silently depend on resource configuration. Alternative: grow or regenerate automatically. Rejected because `TextResources` raster settings are construction-fixed and shared borrowers depend on stable resource identity.

### Mark COLR layers ineligible and leave their existing composition intact

Resource planning distinguishes an ordinary outline from layers produced by `getColorLayers()`. The shader applies outline and drop shadow only to eligible ordinary instances. In mixed text, ordinary glyphs receive the requested paint and COLR glyphs retain their existing ordered palette/current-foreground rendering; synchronization does not reject merely because both coexist.

Outlining each COLR layer would reveal internal seams, while a composed silhouette requires a separate coverage/compositing model. Silently choosing the per-layer result is therefore rejected. The public documentation and tests explicitly state the mixed-text behavior until a dedicated COLR silhouette change selects different semantics.

### Prove the production path, not the validation harness

Deterministic tests cover defaults, validation, nonlinear distance conversion, composition controls, bounds, clipping, appearance-only updates, cache/slot reuse, shared borrowers, rejection recovery, COLR coexistence, both material variants, and disposal. The public example and docs add an interactive ordinary-glyph paint example. Packed-consumer checks compile and execute the new types through public exports.

The actual-WebGPU fixture renders ordinary Latin and Arabic glyphs with independent fill, outline, and shadow colors through shared unlit and planar-lit texts. Semantic pixel/resource observations confirm the expected regions, transparency, clipping, bounds, stable texture UUID/slots after appearance changes, excessive-paint rejection with the prior frame intact, recovery, and repeated cleanup. The private experiment may remain evidence but production code must not import it.

## Risks / Trade-offs

- **[SDF softness is not a Gaussian browser blur]** → Name the control `softness`, document it as distance-field falloff, and fixture its accepted visual range.
- **[More em padding leaves fewer texels for the glyph]** → Keep `0.125em` as the balanced default, expose the fixed resource knob, and require callers requesting larger paint to choose padding and resolution together.
- **[Mixed glyph scales require different threshold conversion]** → Carry one minimal per-instance distance scale and test mixed-size/mixed-font text.
- **[Extra atlas sampling costs fragment work]** → Keep effects disabled by default, retain one draw call and one texture, and avoid speculative multi-effect generalization.
- **[COLR glyphs look inconsistent beside outlined text]** → Make ordinary-only behavior explicit and defer composed silhouettes instead of exposing layer seams.
- **[Transparent source-over composition can produce halos]** → Compose ordered premultiplied contributions internally, return straight color plus final opacity to Three, and verify semantic edge pixels.

## Migration Plan

1. Add and export the two appearance records plus construction-fixed em padding, using the public font facts already present on real handles.
2. Extend SDF framing, resource-plan, and instance metadata while preserving appearance-independent atlas key and slot allocation.
3. Add validation, bounds calculation, TSL sampling/composition, and material control commits behind the nullable fields.
4. Update deterministic tests, package/public examples, documentation, packed consumption, and actual-WebGPU observations.
5. Update the roadmap only after all production evidence passes.

Rollback removes the additive fields and paint nodes. Existing callers require no migration because both effects default to disabled and no serialized layout/resource contract changes.

## Open Questions

None blocking. COLR composed-silhouette paint and true Gaussian/multiple shadows remain separate future decisions.

## Context

The shipped pipeline resolves one ordinary outline per positioned glyph, converts cache misses to monochrome SDF cells, and renders one colored instance per drawable glyph. `LayoutResult` already contains final `fontKey`, `glyphId`, variations, scale, placement, style, lines, carets, and bounds; it deliberately contains no outlines, paint payloads, or renderer objects.

The archived `validate-color-glyph-boundary` change compared COLR v0, COLR v1, sbix, and SVG from one reproducible corpus. It selected COLR v0 + CPAL, proved a bounded table reader, and rendered ordered layer outlines through the production SDF/Three path on actual WebGPU. A broader HarfBuzz color build also worked but increased WASM by 31,884 bytes. The production runtime already owns an exact copy of input bytes, although the current handle does not retain that copy after native construction.

## Goals / Non-Goals

**Goals:**

- Ship useful COLR v0 + CPAL palette-zero glyphs through the public font and Three packages.
- Keep color resolution lazy and downstream of the unchanged renderer-neutral layout handoff.
- Reuse existing numeric outlines, CPU SDFs, RGBA channel-packed atlas slots, TSL materials, atomic synchronization, shared resources, and disposal behavior.
- Handle CPAL RGBA and the current-foreground sentinel honestly.
- Preserve outline-only structural fonts and all existing monochrome consumers.

**Non-Goals:**

- COLR v1 paint graphs, gradients, transforms, clips, or compositing.
- CBDT/CBLC, sbix, SVG documents, image decoding, canvas, or DOM rendering.
- A universal color-glyph union, arbitrary SFNT table access, or another font parser.
- Palette selection beyond CPAL palette zero, palette animation, or implicit browser emoji preference.
- Changes to `PreparedText`, `LayoutResult`, selection/caret geometry, `@webgpu-text/sdf`, font fetching, batching, eviction, or WebGL.

## Decisions

### Add one optional semantic layer operation to the font handle

Extend `FontHandle` with `getColorLayers(glyphId)`, returning an immutable non-empty ordered array or `null`. Each layer contains a glyph ID and either an immutable `{ red, green, blue, alpha }` byte color from CPAL palette zero or the literal current-foreground marker. The Three package mirrors only this optional structural subset so outline-only custom handles remain valid and it does not gain a runtime dependency on the font package.

The method name describes the useful operation rather than exposing COLR tables, but its documented production support is explicitly COLR v0 only. It accepts no palette option because only palette zero is validated; adding a parameter that can only accept one value would be speculative. Layer outlines continue to use `getOutline(layerGlyphId, positionedVariations)`.

Alternative considered: return raw palette indices and a separate palette object. Rejected because it exposes storage mechanics and makes every renderer repeat sentinel and bounds validation. Alternative considered: a generic paint union. Rejected because COLR v1, bitmaps, and SVG do not share the selected layer model.

### Retain the owned source copy and use a bounded private reader

Pass the already-copied `ArrayBuffer` into `FontHandleImplementation` as well as HarfBuzz, retain it only while the handle is live, and add a private reader limited to the SFNT directory, COLR v0 base/layer records, and CPAL palette zero. Parse lazily on the first color request, validate every offset/count before reading, and cache `null`, successful immutable layers, and table facts per handle. Disposal clears this state and releases the retained byte reference.

Fonts without both supported COLR v0 and CPAL return `null`; COLR v1 also returns `null` so an ordinary fallback outline remains usable. Referenced malformed v0 data throws the existing `InvalidFontError`, avoiding a new public error hierarchy for one operation.

Alternative considered: enable the upstream HarfBuzz color exports. Rejected for this increment because the measured universal bridge adds 31,884 WASM bytes and the accepted v0 structures are small. Alternative considered: import the experiment reader. Rejected because production must reimplement the bounded behavior behind package-private tests and never depend on experiments.

### Expand render work inside resource planning, not inside layout

For each final `PositionedGlyph`, resource planning asks the structural font for optional layers. A valid result produces one planned render glyph per layer by retaining the base placement/style/scale and replacing only the outline glyph ID plus resolved paint. A missing result produces the existing single foreground instance. The committed `Text.layoutResult` remains the exact supplied object; line glyph indices, carets, selections, and measurement never observe renderer layer expansion.

Layer SDF keys remain the existing font-object/layer-glyph/variations/SDF-size identity. CPAL and foreground colors do not alter scalable SDF pixels, so they stay in instance data and do not duplicate atlas slots. The font handle's layer lookup cache prevents repeated COLR parsing, while `TextResources` prevents repeated layer outline/SDF work across borrowers.

Alternative considered: manufacture an expanded `LayoutResult`. Rejected because it corrupts line indices and interaction identity with renderer details. Alternative considered: a separate color atlas. Rejected because COLR v0 layers are ordinary outlines already served by the existing atlas.

### Promote instance color from RGB to RGBA

Change the private `glyphColor` instance attribute from three to four normalized bytes. Ordinary foreground and existing `styleColors` use alpha 255. CPAL layers use their exact alpha, and the current-foreground marker resolves through the base glyph's effective style/default color with alpha 255. Both material variants multiply SDF coverage, clipping, text opacity, and instance alpha. Fully transparent layers contribute no visible pixels; the shadow mask must not treat a fully transparent layer as opaque.

All layers use the base glyph placement and are emitted in COLR order. Existing transparent materials already disable depth writes, allowing source-over layer composition in the validated single instanced draw. Actual-WebGPU semantic tests remain the authority for ordering and alpha rather than exact screenshots.

Alternative considered: reject non-opaque CPAL entries. Rejected because CPAL defines alpha and silently narrowing RGBA to RGB would make the public support claim incorrect.

### Preserve the existing atomic commit boundary

Layer lookup, validation, outline/SDF generation, and RGBA instance assembly occur during the existing build/plan phase. No atlas or geometry mutation occurs until the complete plan succeeds and the snapshot is still current. A failure is wrapped in the public renderer error, leaves the last accepted state and shared atlas intact, and does not poison later valid work. Ownership and disposal rules do not change.

### Reuse the validation corpus as production acceptance evidence

Move no experiment implementation into production. Reuse the committed attributed fonts and accepted sequences for public font tests, mixed layout/renderer tests, packed clean-consumer checks, browser ESM, and actual WebGPU semantic assertions. Cover default color, current foreground, CPAL alpha, ordinary fallback, malformed records, repeated/shared reuse, two sizes, unlit/lit materials, updates, failure recovery, and disposal. Update package docs, architecture, roadmap, and notices only after the public behavior passes.

## Risks / Trade-offs

- **[Retaining source bytes duplicates memory already copied into WASM]** → Retain only the existing validated copy, release it on disposal, and accept the bounded cost until a measured zero-copy native lifetime is justified.
- **[Malformed optional tables could break otherwise usable fonts]** → Parse only on color lookup; ordinary shaping and outlines remain usable unless a renderer explicitly requests color layers.
- **[Layer expansion increases instance count and atlas occupancy]** → Reuse layer SDFs across repeated glyphs/texts and defer batching or eviction until measurements show a real ceiling.
- **[Transparent primitive ordering can vary across GPU backends]** → Keep the validated source-over single-draw path and require semantic actual-WebGPU ordering checks on supported Three revisions.
- **[A COLR v1 font may fall back to visually poor outlines]** → Document v0-only support and return `null`; never claim partial v1 rendering.
- **[Explicit font order differs from automatic browser emoji preference]** → Preserve deterministic caller order and scope any presentation preference as a separate layout change.

## Migration Plan

1. Add and test the public font-layer types and bounded private reader without changing existing operations.
2. Extend the optional structural Three font surface and resource plan while preserving outline-only handles.
3. Add RGBA instance data and material alpha handling for both material variants.
4. Validate public packages, clean packed consumption, browser ESM, and actual WebGPU against the accepted corpus.
5. Update documentation and mark COLR v0 shipped only after every acceptance check passes.

The change is additive. Rollback removes the optional font operation and renderer layer branch; existing `LayoutResult`, SDF data, ordinary outline caches, and monochrome rendering require no migration.

## Open Questions

None. Palette zero, explicit font order, COLR v0 scope, retained bytes, RGBA handling, and renderer ownership are fixed by the validation evidence for this increment.

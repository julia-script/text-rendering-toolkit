## Context

`@webgpu-text/three` now renders resolved text with one instanced unit quad, an RGBA SDF atlas, and `MeshBasicNodeMaterial`. Its material graph supplies per-instance placement and color plus derivative-antialiased SDF opacity, but the geometry intentionally has no lighting normal and neither the package nor the earlier WebGPU experiment exercises a shadow pass.

The pinned Three.js 0.185.1 node-material surface exposes `MeshStandardNodeMaterial`, `positionNode`, `colorNode`, `opacityNode`, `maskShadowNode`, and ordinary `Object3D.castShadow`/`receiveShadow` controls. Three's WebGPU shadow path is expected to reuse `positionNode` and apply `maskShadowNode`, but source-level availability is not runtime evidence. A transparent SDF quad could otherwise render correctly in the color pass while casting a rectangular shadow.

This is a private, reversible validation change. It must answer the seam questions on the same actual-WebGPU environment used by the existing experiment before any production API or material ownership decision is made.

## Goals / Non-Goals

**Goals:**

- Prove that the existing instanced glyph placement, atlas addressing, and visible SDF coverage compose with one standard node material.
- Prove glyph-shaped cast shadows, including transparent margins and a known interior cutout.
- Prove received shadows darken visible glyph interiors without making transparent exterior pixels visible.
- Identify the minimum additional renderer data or node hooks required by a future production lit material.
- Preserve deterministic checks, actual-WebGPU semantic observations, a reviewed frame, and exact environment metadata.

**Non-Goals:**

- Modifying `@webgpu-text/three`, adding a public material selector, or promising a production lit API.
- Supporting `MeshPhysicalNodeMaterial`, normal maps, environment maps, emissive controls, transmission, clearcoat, or arbitrary caller materials.
- Curved text normals, extruded glyph geometry, back-face lighting, colored/transmitted shadows, outlines, strokes, or shadow-quality tuning as public options.
- Revalidating font parsing, layout, SDF generation, atlas growth, synchronization, or production package installation.
- Supporting WebGL or widening the pinned Three.js revision.

## Decisions

### Add one standard-material branch to the existing private experiment

The experiment will retain its fixed atlas and instanced fixture and add a lit mesh constructor beside the proven unlit constructor. Shared local helpers may assemble glyph placement, atlas sampling, color, and SDF coverage once for both material branches, provided the existing unlit browser evidence remains unchanged.

This is smaller and more diagnostic than modifying the production `Text` class: a production change would combine uncertainty about Three's lighting/shadow hooks with API, lifecycle, material-selection, geometry, and documentation decisions. A separate new experiment package was rejected because the current rendering-seam workspace already owns the pinned browser harness and fixture.

### Use one planar `MeshStandardNodeMaterial`

The lit branch will use `MeshStandardNodeMaterial` with metalness `0`, fixed high roughness, per-instance `colorNode`, the existing `positionNode`, and the existing antialiased SDF expression in `opacityNode`. The lit geometry will provide a front-facing planar normal through the ordinary geometry normal attribute so object transforms use Three's normal pipeline. The fixture will validate only the front face.

`MeshPhysicalNodeMaterial` was rejected because none of its additional controls are needed to answer the seam question. A custom lighting model and `outputNode` were rejected because they would bypass the standard scene-light integration being evaluated. A constant shader-space normal was rejected in favor of ordinary geometry data because its coordinate-space behavior under object transforms would be less representative of a production mesh.

### Use a dedicated binary shadow mask from the same SDF sample

Visible edges will continue to use derivative-antialiased opacity. The shadow pass will instead receive `maskShadowNode` derived from the same atlas channel and clip coverage with a fixed inside threshold at the encoded SDF midpoint. The material's `positionNode` remains the sole instanced placement expression so the visible and shadow passes cannot drift.

Using opacity alone was rejected because transparent blending does not guarantee alpha-tested shadow-map coverage. `castShadowNode` was rejected for this proof because colored/transmitted shadow output is not required and would introduce `shadowMap.transmitted` policy. Applying one binary `maskNode` to both passes was rejected because it would discard the visible antialiased fringe.

### Exercise cast and receive behavior in one controlled orthographic scene

The browser harness will add a directional light with shadows enabled, a parallel receiving surface behind the text, and a simple external occluder positioned so its projected shadow crosses a known glyph-interior region without covering that region from the camera. Angled light placement will offset text-cast shadows onto visible receiver regions. Large fixture features, an explicit shadow camera, fixed map size, and fixed bias will make semantic regions stable enough for tolerant observations.

The test will capture controlled states from the same scene: an ordinary lit state without scene shadows, a shadow-enabled state, and a light-contribution control. It will compare region statistics rather than exact full-frame pixels. The final shadow-enabled state becomes the reviewed frame; machine-readable evidence records all comparison counts.

A perspective showcase scene was rejected because projection adds unnecessary variability. Separate standalone cast and receive demos were rejected because one controlled scene and state transitions can prove both with fewer resources and one lifecycle.

### Keep deterministic checks structural and browser checks semantic

Non-browser tests will verify the material kind, required node assignments and controls, planar normal data, reuse of instanced attributes, disposal, and the absence of GLSL, WebGL, shader rewriting, or private Three imports. They will not pretend to execute Three's GPU lighting compiler.

The actual browser test will require `navigator.gpu`, a usable adapter, and the existing WebGPU backend diagnostic. Tolerant observations will prove light response, color separation, transparent margins, glyph cutouts in cast shadows, received-shadow contrast, and instanced shadow placement. Missing WebGPU and WebGL fallback remain failures, not skipped success.

### Let evidence choose the production follow-up

The validation report, `ARCHITECTURE.md`, and `ROADMAP.md` will state which public hooks worked and any limitations. A successful seam permits a later proposal for one dedicated production standard material variant; it does not decide whether that variant is selected by an option, separate class, or explicit material factory. A failed seam records the exact failing pass and keeps the current unlit renderer as the only production surface.

## Risks / Trade-offs

- **Shadow-map filtering, bias, or adapter differences can move edge pixels** → Use large regions, compare counts/contrasts with tolerance, pin the browser and Three revisions, and record the adapter.
- **A glyph can hide its own projected shadow in a frontal composition** → Offset the directional light and reserve receiver regions outside visible instance bounds.
- **The occluder can cover the glyph rather than only shadow it** → Position it outside the camera-visible glyph region and verify an unshadowed control capture before enabling shadows.
- **`maskShadowNode` may not sample the instanced atlas correctly in Three's shadow pass** → Treat that as the primary result; do not work around it with private renderer code or a second shadow mesh.
- **Planar front-face evidence does not establish curved, double-sided, or extruded normals** → State that limit explicitly and defer those geometries.
- **Refactoring shared experimental nodes could regress the existing unlit fixture** → Keep the helper local and require both existing browser tests and the new fixture to pass.
- **A fixed synthetic atlas proves the rendering seam, not production integration** → Require a separate production proposal after success; do not change public status from this experiment alone.

## Migration Plan

1. Add the smallest reusable experimental node assembly and lit material/mesh constructor while retaining the unlit fixture.
2. Add deterministic material, geometry-normal, boundary, and disposal checks.
3. Add the controlled lit/shadow harness and actual-WebGPU semantic test, iterating only fixture coordinates and tolerant thresholds needed for stable evidence.
4. Commit the reviewed final frame and machine-readable observations, then document the result and update the roadmap/architecture from evidence.
5. Run the entire experiment browser suite, workspace checks/builds, and strict OpenSpec validation.

Rollback is deletion of the lit fixture, tests, evidence, and documentation updates. The shipped renderer and earlier unlit experiment remain intact.

## Open Questions

- Does `maskShadowNode` receive the atlas texture and instanced flat-slot attributes correctly in the pinned WebGPU shadow pass?
- Does the renderer automatically reuse `positionNode` for shadow-map projection without a separate `castShadowPositionNode`?
- Does standard-material received-shadow shading remain correctly multiplied by the visible SDF opacity?
- Is an ordinary planar normal attribute sufficient, or does the node pipeline require an explicit `normalNode` for the instanced position override?
- If the seam passes, what is the smallest production surface: an explicit material mode on `Text`, a separate lit text class, or a narrowly exported material constructor? That choice belongs to the follow-up proposal.

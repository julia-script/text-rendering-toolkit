## Context

The production renderer already has the difficult parts: real-font
`LayoutResult` input, lazy outline/SDF generation, an RGBA atlas, instanced
glyph geometry, shared TSL coverage/color/clipping nodes, atomic updates, and
owned-resource disposal. It currently binds those nodes only to
`MeshBasicNodeMaterial`.

The private rendering experiment independently proved the missing planar seam
on the pinned Three.js revision: a fixed `normal` attribute,
`MeshStandardNodeMaterial`, the existing position/color/opacity nodes, a binary
SDF `maskShadowNode`, and `shadowSide` equal to the visible material side. That
proof used only public WebGPU/TSL surfaces and validated lit color, transparent
coverage, glyph-shaped cast shadows, received shadows, and disposal on actual
WebGPU. This change promotes that seam into production without broadening the
text-preparation boundary.

## Goals / Non-Goals

**Goals:**

- Let a caller opt into planar standard-material text when constructing `Text`.
- Share glyph placement, atlas decoding, antialiasing, color, opacity, clipping,
  update, and disposal behavior between unlit and lit text.
- Make ordinary Three.js `castShadow` and `receiveShadow` flags work on visible
  glyph coverage rather than instance rectangles.
- Validate the integrated path with public real-font input and actual WebGPU.

**Non-Goals:**

- Switching material kind after construction.
- A general material factory, arbitrary caller material, or shader extension
  API.
- Public metalness, roughness, normal-map, transmission, clearcoat, or other
  physical-material controls in this first surface.
- Curved normals, double-sided lighting, thickness, extruded text, or a WebGL
  fallback.
- Any change to shaping, layout, font acquisition, SDF encoding, or atlas
  ownership.

## Decisions

### Use one construction-only `lit` option

`TextOptions` gains `readonly lit?: boolean`; omission and `false` select the
existing unlit material, while `true` selects the planar standard material.
`Text` records the resolved value as `readonly lit`, and its material kind is
never part of mutable synchronization state.

A boolean is sufficient because this change introduces exactly one alternative
to the default. A string mode or material-options hierarchy would add a public
abstraction for variants that do not exist. A separate `LitText` class would
duplicate the complete renderer lifecycle.

### Share node assembly and keep the standard surface fixed

The production material builder will first assemble the common position,
atlas-channel selection, SDF coverage, clip coverage, color, and opacity nodes.
It will then bind those nodes to either the existing `MeshBasicNodeMaterial` or
one `MeshStandardNodeMaterial`.

The standard material uses the proven non-metallic planar values (`metalness: 0`,
`roughness: 0.9`), transparency, and disabled depth writes. These values are not
new `Text` synchronization properties. Exposing tunable PBR controls can follow
when a concrete application needs them; they are unnecessary to establish lit
scene participation.

### Add only the geometry and shadow data required by Three

Glyph geometry supplies a constant local `+Z` normal for the indexed unit quad.
The standard material reuses the visible position, color, and antialiased
opacity nodes. Its shadow mask applies clipping and accepts SDF samples at the
encoded midpoint, and `shadowSide` matches the visible material side.

The package does not create duplicate shadow geometry, rewrite shaders, attach
private renderer hooks, or set `castShadow`/`receiveShadow` automatically.
Callers use those ordinary Three.js mesh flags according to their scene.

### Keep synchronization and ownership unchanged

Material kind is resolved once before the `Mesh` constructor completes, so a
sync only updates the same layout, geometry attributes, atlas, and shared
appearance uniforms it updates today. Failure atomicity and latest-state
coalescing therefore need no second path. Disposal continues to release exactly
one object-owned geometry, material, and atlas while leaving fonts, renderer,
canvas, lights, and scene resources caller-owned.

### Promote the proof through the production real-font fixture

Deterministic tests will assert material selection, planar normals, public node
hooks, shared control updates, fixed construction semantics, and idempotent
disposal. The packed TypeScript consumer and public example will demonstrate
`lit: true` without importing experiment code.

The actual-WebGPU production fixture will render completed Latin/Arabic layout
through the production atlas and standard material in a controlled lit/shadow
scene. Tolerant semantic regions will verify light response, glyph-shaped cast
shadows including a transparent cutout, received-shadow contrast, preserved
color/coverage, a post-sync layout or appearance update, backend identity, and
repeated disposal. The isolated experiment remains historical seam evidence;
production code does not depend on it.

## Risks / Trade-offs

- **The `Text.material` type becomes a basic/standard union** → Export the
  concrete union in public declarations and narrow it through `text.lit` or the
  standard Three.js instance type when material-specific access is needed.
- **A fixed planar normal is wrong for curved or back-lit geometry** → Document
  the variant as front-facing planar text and keep those geometries out of this
  change.
- **A binary shadow mask differs from antialiased visible coverage** → Use the
  already validated midpoint threshold appropriate to shadow-map coverage while
  preserving antialiasing in the visible pass.
- **Transparent standard materials and shadows are revision-sensitive** → Keep
  the existing Three.js pin and actual-WebGPU fallback rejection; revisit the
  seam when upgrading Three.
- **Fixed PBR values may be too narrow for later art direction** → Add controls
  only after a consumer requirement establishes their update and validation
  semantics.

## Migration Plan

No existing caller changes are required because omitted `lit` remains unlit.
Callers opt in with `new Text({ ..., lit: true })`, enable the ordinary Three.js
shadow flags they need, and configure renderer/lights/shadow maps at the scene
level. Rollback is removing the option or setting it to `false`; layout and font
inputs remain identical.

## Open Questions

None for this bounded implementation.

## Context

See proposal.md — Why. Current state that shapes the approach:

- `createGlyphNodeAssembly` (`packages/three/src/rendering.ts`) already computes every value the mode needs per fragment: `fillAlpha`, `composedAlpha`, `clipCoverage`, `visibleOpacity`, plus a ≥ 0.5 threshold mask precedent (`shadowMask`). Each call mints its own uniform set and returns them as `controls`.
- `createGlyphMaterial` builds one material (basic or standard) from one assembly; `updateGlyphMaterial` writes appearance into a `controls` object.
- `Text extends Mesh` with exactly one geometry and one material; `sync()` commits geometry via `updateGlyphGeometry` and appearance via `updateGlyphMaterial`; `dispose()` releases `this.geometry`, `this.material`, and owned resources.
- A proven reference implementation of the two-pass recipe exists in effect-motion's renderer (`packages/renderer/src/Text.ts`, `makeMesh`): core pass at flat opacity with `alphaTest`, `depthWrite: true`, `LessDepth`; edge pass blending `coverage < 0.5` without depth writes.

## Goals / Non-Goals

**Goals:**

- Two-pass mode as a construction-time material topology choice; zero behavior change for existing callers.
- One shared uniform `controls` set driving both passes, so `updateGlyphMaterial` and the `sync()` commit path stay single-write.
- Geometry sharing by object identity — the edge pass must never require a second geometry update.

**Non-Goals:**

- A lit (`MeshStandardNodeMaterial`) depth-ink variant. Rejected at construction; design it when a consumer needs it.
- Deduplicating overlapping *edge* fragments (AA rings, overlapping outlines). Inherent residual of the approach; visually negligible and accepted by the reference implementation too.
- Any change to atlas packing, `TextResources`, or layout contracts.

## Decisions

**1. Core membership = `fillAlpha · clipCoverage ≥ 0.5`, not `composedAlpha`.**
Composed alpha includes outline and shadow; a soft shadow's interior exceeds 0.5 and would flatten to full opacity, destroying the gradient. Fill-only core preserves single-pass output exactly where effects are off, and routes all effect ink through the blending pass. Alternative considered — `composedAlpha ≥ 0.5` core with per-layer color: rejected, breaks soft shadows and complicates the flat-opacity contract.

**2. Assembly refactor: `createGlyphNodeAssembly(atlas, grid, controls?)`.**
The assembly optionally receives a pre-built controls set instead of minting uniforms. The layered creator builds controls once, runs the assembly twice (core and edge nodes differ only in their opacity/alpha-test wiring), and returns `{ coreMaterial, edgeMaterial, controls }`. Alternative — duplicate controls updated in lockstep by `updateGlyphMaterial`: rejected, doubles the mutation surface and invites drift between passes.

**3. Core pass alpha wiring mirrors the reference implementation.**
`opacityNode = select(fillAlpha·clip ≥ 0.5, opacity, 0)` with `alphaTestNode` just above zero (1/255), `depthWrite: true`, `depthFunc: LessDepth`. The alpha test discards non-core fragments so they never write depth; equal-depth core ink from another glyph fails `LessDepth` and is deduplicated. Edge pass: `select(fillAlpha·clip ≥ 0.5, 0, visibleOpacity)`, `depthWrite: false`, default depth test.

**4. Edge pass rides as an internal child `Mesh` sharing `this.geometry`.**
`Text` remains a `Mesh` (core pass) — no public type change, transforms and `add()` semantics untouched. The child is created in the constructor when `depthInk` is set, added to `this`, `frustumCulled = false` like its parent, and hidden/shown together with the parent's instance count. Alternatives — `Text extends Group`: breaking public type; three.js multi-material groups: not applicable to one instanced draw needing different depth state per pass.

**5. `depthInk` is fixed at construction, like `lit`.**
Material topology (one vs two materials, depth state) is set at build time; toggling would mean rebuilding materials inside `sync()` for a niche need. Reconstruct the `Text` to change it.

**6. Validation follows the existing option-reading contract.**
`depthInk` is read once through the same guarded option-reading path as `lit`, rejects non-boolean values with `InvalidTextInputError`, and the `depthInk && lit` combination rejects before any resource is created.

## Risks / Trade-offs

- [Doubled draw calls per depth-ink text] → Two instanced draws over one geometry; cost is per-`Text`, not per-glyph, and only for opted-in meshes.
- [AA ramp flattening: the inner half of the fill antialiasing ramp (coverage 0.5–1) renders at flat opacity] → Same trade the reference implementation ships; at glyph scale the half-ramp is sub-pixel and invisible in practice.
- [Child mesh escapes `Text`'s public `children`] → Document it as internal; skip it in raycast by leaving the child's `raycast` a no-op if tests show it interfering.
- [Render-order interaction: edge pass must draw after core within the transparent queue] → Both passes are `transparent: true` at identical position/depth, so the sorter's stable order applies and parent-before-child traversal already puts core before edge. An explicit `renderOrder` bump was considered and rejected: `renderOrder` is a global sort key that outranks depth, so raising the edge pass would draw it after unrelated *nearer* transparent objects and corrupt their blending. Rely on traversal order; documented in the constructor.
- [WebGPU depth-test behavior differences vs the reference (WebGL-era troika lineage)] → Validation evidence via the existing rendering-seam test harness; the effect-motion consumer revalidates downstream.

## Migration Plan

Additive, default-off; no migration. Ships in a minor release (0.3.0). Rollback is not constructing with `depthInk: true`.

## Open Questions

None.

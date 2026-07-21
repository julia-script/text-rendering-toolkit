## 1. Experimental lit material

- [x] 1.1 Add one local glyph-node assembly in `experiments/webgpu-rendering-seam` that exposes the existing instanced position, atlas sample/channel, color, clip coverage, and antialiased SDF coverage without changing their unlit behavior.
- [x] 1.2 Keep the existing `MeshBasicNodeMaterial` fixture on the shared node assembly and prove its current controls and browser observations remain unchanged.
- [x] 1.3 Add front-facing planar normal data and a dedicated `MeshStandardNodeMaterial` branch with fixed non-metallic/high-roughness controls, per-instance color, existing position, and antialiased visible opacity.
- [x] 1.4 Add a binary `maskShadowNode` from the same atlas sample and clip coverage at the encoded SDF midpoint, without `castShadowNode`, transmitted-shadow policy, a duplicate shadow mesh, or private renderer APIs.
- [x] 1.5 Add a lit mesh constructor and idempotent experimental resource cleanup while leaving every publishable package and public export unchanged.

## 2. Deterministic seam checks

- [x] 2.1 Test that the lit fixture reuses the indexed unit quad and instanced bounds/slot/color attributes, supplies planar normals, and constructs a standard node material with the required visible and shadow nodes.
- [x] 2.2 Test fixed standard-material values, shared atlas/position identity, shadow-mask presence, ordinary cast/receive object flags, and owned geometry/material/texture disposal.
- [x] 2.3 Add boundary assertions that the lit experiment contains no GLSL strings, `ShaderMaterial`, `onBeforeCompile()`, WebGL APIs, private Three imports, production-package modifications, or new runtime dependencies.

## 3. Controlled WebGPU shadow harness

- [x] 3.1 Add a lit browser harness that reuses the existing WebGPU availability/backend rejection, fixed viewport, capture path, and pinned adapter metadata.
- [x] 3.2 Configure one orthographic front-facing scene with a fixed directional light and shadow camera, the lit glyph mesh, a parallel receiving surface, and an off-axis external occluder.
- [x] 3.3 Expose only the state transitions needed to capture a light-contribution control, a lit no-shadow control, and the final shadow-enabled state from the same resources.
- [x] 3.4 Implement tolerant region-statistic helpers for filled glyphs, transparent margins, color separation, known cutouts, projected instance shadows, received-shadow contrast, and unchanged control regions.
- [x] 3.5 Dispose the mesh, receiver, occluder, lights, textures, materials, geometries, renderer, and canvas across repeated harness lifecycles.

## 4. Actual-WebGPU evidence

- [x] 4.1 Add a browser test proving directional-light response and preserved per-instance color/antialiased SDF coverage against the light-contribution control.
- [x] 4.2 Prove cast shadows occupy projected filled-glyph regions for multiple instances while transparent quad margins and a known glyph cutout remain unshadowed.
- [x] 4.3 Prove an external occluder darkens the intended glyph-interior region while an unshadowed glyph control and transparent exterior remain valid.
- [x] 4.4 Prove disabling scene shadows restores ordinary lit coverage on the same geometry/atlas and keep missing WebGPU or WebGL fallback as non-passing evidence.
- [x] 4.5 Run repeated create-render-state-transition-dispose cycles and preserve one reviewed final frame plus machine-readable observations, backend/browser/Three revisions, fixture integrity, and frame hash.

## 5. Record the decision

- [x] 5.1 Write the lit/shadow seam validation report with exact reproduction commands, semantic thresholds/results, public node hooks used, environment revisions, and explicit planar/synthetic-fixture limits.
- [x] 5.2 Update `ARCHITECTURE.md` with the observed position, normal, visible-opacity, cast-mask, and received-shadow behavior, clearly separating public Three APIs from revision-specific implementation observations.
- [x] 5.3 Update `ROADMAP.md` from evidence: either promote one bounded production lit-material follow-up or record the failed seam and retain unlit text as the only production direction; do not choose the future public API shape here.

## 6. Final verification

- [x] 6.1 Run all deterministic rendering-seam tests and the complete existing plus new actual-WebGPU browser suite on the documented backend.
- [x] 6.2 Inspect the committed frame and machine-readable observations, verify their hash/integrity references, and confirm no artifact reports WebGL fallback as passing.
- [x] 6.3 Run workspace formatting, type checking, tests, builds, dependency/boundary checks, and strict OpenSpec validation.

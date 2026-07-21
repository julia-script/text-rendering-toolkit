## Why

The shipped renderer proves flat unlit SDF text, but the next roadmap capability—text that participates in lit 3D scenes—still depends on an untested Three.js WebGPU seam. Before adding a production material API, we need actual-WebGPU evidence that public node-material hooks can light the existing instanced glyph quads and preserve glyph-shaped casting and receiving of shadows rather than treating each transparent quad as a solid rectangle.

## What Changes

- Extend the private WebGPU rendering experiment with one dedicated `MeshStandardNodeMaterial`-based SDF text fixture that reuses the proven instanced bounds, RGBA atlas sampling, and derivative coverage model.
- Validate front-facing diffuse lighting with deliberately non-metallic, fixed-roughness planar glyphs; do not introduce a general material-derivation system or a physical-material option matrix.
- Validate glyph-shaped cast shadows through Three's public shadow-mask/position hooks and validate that lit glyphs can receive a shadow while retaining correct visible SDF coverage.
- Run semantic browser observations on the pinned actual-WebGPU backend, reject unavailable WebGPU or WebGL fallback, and commit one reviewed frame plus machine-readable environment and result metadata.
- Record which public Three.js 0.185.1 node hooks are sufficient, any revision-specific limitations, and the smallest justified production follow-up in the architecture and roadmap.
- Keep `@webgpu-text/three` and every public package API unchanged during this proof.

## Capabilities

### New Capabilities

- `lit-text-shadow-seam-validation`: Actual-WebGPU evidence for lighting existing SDF glyph instances and producing glyph-shaped cast/receive shadow behavior through public Three.js node-material APIs.

### Modified Capabilities

None. This change validates a future renderer capability without changing the shipped unlit renderer contract.

## Impact

- Affected implementation is limited to the private `experiments/webgpu-rendering-seam` fixture and its deterministic/browser tests.
- Validation evidence is added under `docs/validation` and the experiment's committed artifacts; `ARCHITECTURE.md` and `ROADMAP.md` are updated only from observed results.
- The experiment remains pinned to Three.js and `@types/three` 0.185.1 and uses the existing browser harness, Vitest Browser Mode, Playwright installation, and WebGPU backend checks. No new runtime dependency or publishable package is introduced.
- Production font, layout, SDF, and Three renderer packages remain unchanged, as do their ownership, synchronization, atlas, and disposal contracts.

## Why

The project depends on replacing Troika's GLSL rewriting with a Three.js TSL material that renders instanced SDF glyphs through an actual WebGPU backend. That path remains the largest unvalidated product risk, so it should be proven with fixed renderer-neutral inputs before the font, layout, SDF, or public `Text` APIs are implemented around it.

## What Changes

- Add a private strict-TypeScript rendering experiment using one exact Three.js revision and a real browser WebGPU backend.
- Render several instanced glyph quads from a deterministic hard-coded RGBA SDF atlas using TSL for placement, channel selection, distance decoding, antialiasing, color, opacity, orientation, curvature, and clipping.
- Demonstrate that atlas bytes and instance data can change after the first render and reach the next rendered frame without rebuilding unrelated resources.
- Add automated backend assertions, deterministic visual evidence, and a concise validation report that records the proven renderer input, geometry, atlas, material, update, and disposal boundaries.
- Keep the experiment private and exclude font loading, shaping, text layout, SDF generation, workers, batching, lighting, and the public `Text` lifecycle.

## Capabilities

### New Capabilities

- `webgpu-rendering-seam-validation`: Defines the executable and visual evidence required to validate instanced RGBA-atlas SDF text rendering through Three.js TSL on a real WebGPU backend.

### Modified Capabilities

None.

## Impact

- Adds a private experiment under `experiments/` and the minimum browser harness needed to render and inspect deterministic frames.
- Uses the existing `@webgpu-text/three` peer range as guidance but pins one exact Three.js revision inside the experiment so observations are reproducible.
- Adds fixed atlas/instance fixtures, screenshots or pixel observations, and a validation report; no public package export or production API is introduced.
- May refine `ROADMAP.md` and `ARCHITECTURE.md` after evidence establishes the renderer contract, but does not change the documented package dependency direction.

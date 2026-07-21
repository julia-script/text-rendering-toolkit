## 1. Scaffold the Private Rendering Experiment

- [x] 1.1 Add only `experiments/webgpu-rendering-seam/` to the pnpm workspace and create an explicitly private strict-TypeScript, ESM-only package pinned to `three@0.185.1`
- [x] 1.2 Add the minimum Vitest Browser Mode and Playwright-provider configuration for one Chromium instance, including reproducible browser installation and headless/visible validation commands
- [x] 1.3 Integrate the experiment with the root Turbo and Biome checks while keeping every experiment module out of the `@webgpu-text/*` public exports

## 2. Establish Deterministic Renderer Fixtures

- [x] 2.1 Commit a small project-created RGBA atlas fixture with straight, diagonal, curved, and narrow SDF features stored in separate channels
- [x] 2.2 Record fixture dimensions, distance encoding, provenance, and integrity values without adding a runtime SDF generator or depending on a font file
- [x] 2.3 Add fixed typed instance fixtures for glyph bounds, atlas slots/channels, and colors plus fast integrity tests that diagnose malformed lengths, indices, or values

## 3. Implement the Minimal TSL Rendering Seam

- [x] 3.1 Build one reusable unit quad as `InstancedBufferGeometry` and map the fixed glyph bounds, atlas slots, and colors to typed instance attributes
- [x] 3.2 Create and configure the RGBA `DataTexture` so TSL can derive atlas cell coordinates and select the requested channel per instance
- [x] 3.3 Implement the minimal unlit TSL material for signed-distance decoding, derivative antialiasing, per-glyph color, material opacity, and transparent coverage without shader rewriting
- [x] 3.4 Add the smallest uniform-driven rectangular clipping, orientation, and cylindrical-curvature transforms needed by the visual fixture
- [x] 3.5 Provide a private create-render-update-dispose harness with explicit ownership of geometry, attributes, material, texture, renderer, and DOM resources

## 4. Prove the Seam in a Real Browser

- [x] 4.1 Require `navigator.gpu`, acquire a usable adapter, initialize `WebGPURenderer`, and implement the least-private reliable assertion that the pinned renderer selected its WebGPU backend
- [x] 4.2 Render a fixed-size scene and add tolerant semantic frame assertions for occupied and transparent regions, channel/color separation, antialiased edges, clipping, orientation, and curvature
- [x] 4.3 Capture a human-reviewable reference frame and record the Three revision, browser, operating system, available adapter information, viewport, and launch configuration
- [x] 4.4 Mutate one atlas channel and selected instance bounds/colors after the first completed frame, then prove that the next frame changes the targets while untouched instances remain stable
- [x] 4.5 Repeat the create-render-update-dispose lifecycle and verify that the second run does not depend on resources retained by the first
- [x] 4.6 Add an explicit failure or unsupported-environment result for missing WebGPU and for any detected WebGL fallback so neither can be recorded as passing evidence

## 5. Record the Renderer Decision

- [x] 5.1 Write `docs/validation/webgpu-rendering-seam.md` with reproduction commands, observations, limitations, unstable Three.js APIs, failed assumptions, and the exact validated environment
- [x] 5.2 Decide and document the smallest production renderer input, instanced geometry, TSL material, atlas-update, backend-validation, and disposal boundaries that can later move into `@webgpu-text/three`
- [x] 5.3 Update `ROADMAP.md` and `ARCHITECTURE.md` so demonstrated behavior becomes a decision and any unresolved renderer risk becomes a bounded follow-up

## 6. Verify and Close the Spike

- [x] 6.1 Run a clean pnpm install plus the root Biome, build, typecheck, and Vitest commands with the private experiment included
- [x] 6.2 Run the documented actual-WebGPU browser validation from a clean build and verify all committed observations and fixture integrity values
- [x] 6.3 Run strict OpenSpec validation and confirm the experiment remains private, uses no `old/` runtime dependency, and introduces no public package API

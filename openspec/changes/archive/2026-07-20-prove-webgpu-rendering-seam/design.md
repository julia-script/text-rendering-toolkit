## Context

The preserved renderer builds text by rewriting classic Three.js GLSL, assigning instanced glyph attributes, and sampling four glyph SDFs packed into each RGBA atlas square. The greenfield project keeps the useful instancing and atlas ideas but targets `WebGPURenderer`, where classic `ShaderMaterial` and `onBeforeCompile()` customization are not the supported path. The replacement must be expressed through Three.js Shading Language (TSL) and node-material inputs.

The workspace now contains an empty `@webgpu-text/three` package, but the font, layout, and SDF packages do not yet produce real data. The renderer seam can therefore be tested most cheaply with a synthetic atlas and fixed glyph instances. The result is evidence about Three.js and the GPU boundary, not an early public API.

Three.js `WebGPURenderer` can automatically fall back to its WebGL 2 backend. That fallback does not satisfy this change: the project does not promise or test WebGL support, and a successful fallback frame would hide the exact risk this experiment exists to measure.

## Goals / Non-Goals

**Goals:**

- Prove that a pinned Three.js revision can render instanced SDF glyph-like quads through TSL on an actual WebGPU backend.
- Confirm the smallest renderer-side data contract for glyph bounds, atlas location/channel, color, and material-wide appearance inputs.
- Validate RGBA channel packing, signed-distance decoding, derivative antialiasing, transparency, clipping, orientation, and curved placement.
- Prove predictable post-initial-render updates for atlas bytes and instance data.
- Leave reproducible browser checks, visual evidence, resource cleanup, and a written decision about what can be promoted into `@webgpu-text/three`.

**Non-Goals:**

- Implementing or exporting the production `Text` class, renderer atlas, or public material and geometry APIs.
- Loading fonts, shaping text, laying out lines, generating SDFs, allocating atlas slots, or running workers.
- Supporting or validating WebGL, arbitrary classic Three.js materials, lighting, shadows, batching, atlas eviction, or WebGPU compute.
- Matching every Troika appearance option or preserving its attribute names, callback APIs, and shader structure.
- Establishing a cross-GPU exact screenshot baseline where driver-level rasterization differences make exact pixels unreliable.

## Decisions

### Keep the seam in a private workspace experiment

Create `experiments/webgpu-rendering-seam/` as an explicitly private workspace package and include only that exact experiment path in `pnpm-workspace.yaml`. It uses the root TypeScript, Biome, Turbo, and Vitest conventions while keeping its source outside the public `@webgpu-text/three` exports.

This mirrors the successful HarfBuzz validation pattern: code is promoted only after its boundary is proven. Starting directly in `packages/three/src` was considered and rejected because it would make provisional types and material structure look production-ready before the browser evidence exists.

### Pin Three.js and use Vitest Browser Mode with Playwright

Pin `three@0.185.1` exactly inside the experiment. Use Vitest Browser Mode with the Playwright provider and one Chromium instance so the existing test framework runs the real ESM browser code, can capture frames, and participates in the root validation commands. Record the browser, operating system, Three revision, adapter information available through public WebGPU APIs, and launch configuration with each observation.

A hand-written server plus Puppeteer was considered. It offers similar browser control but duplicates test orchestration already provided by Vitest and adds a second browser-test convention. A purely manual example was rejected because it cannot protect the seam from later Three upgrades.

### Require WebGPU evidence and reject fallback as a passing result

The browser check first requires `navigator.gpu` and a usable adapter. After renderer initialization it records and asserts the least-private reliable backend signal available in the pinned Three revision. If Three exposes no stable public backend identity, the experiment may use a narrowly isolated diagnostic against the pinned implementation, but the report must label that coupling and recommend how future validation should detect fallback.

A software WebGPU adapter is acceptable because it still exercises the WebGPU API and Three's WebGPU backend. WebGL fallback, `forceWebGL`, and WebGL-specific code paths are not acceptable evidence. The experiment does not attempt to make TSL incapable of compiling to GLSL; it simply makes WebGL results non-authoritative and unsupported.

### Use synthetic fixed inputs instead of lower-layer packages

Commit a small deterministic RGBA `Uint8Array` atlas fixture containing four project-created glyph-like SDF shapes, one in each channel of a shared atlas cell. Commit fixed typed instance data for bounds, atlas cell/channel, and color. The fixture metadata explains how the bytes were produced and confirms that no font parser, layout engine, SDF runtime, or untracked `old/` file is required.

The experiment operates on a narrow internal shape equivalent to:

```ts
interface RenderFixture {
  atlas: {
    width: number
    height: number
    pixels: Uint8Array
    distanceRange: number
  }
  instances: {
    bounds: Float32Array
    atlasSlots: Uint32Array
    colors: Uint8Array
  }
}
```

These names are experimental and are not exported. Reusing real font or SDF output was rejected because it would couple the test to unimplemented layers and make renderer failures harder to isolate.

### Preserve RGBA packing but validate only renderer ownership

Each atlas cell stores up to four one-channel SDFs in RGBA. An instance's atlas slot determines both the cell coordinates and selected channel. The TSL graph samples the `DataTexture`, selects the requested channel, decodes the stored distance, and computes coverage with screen-space derivatives.

This validates the representation already selected in the architecture without implementing allocation, growth, caching, or eviction. A one-channel texture array was considered but rejected for this spike because it would invalidate the chosen compact representation instead of testing it.

### Build the minimum unlit TSL material and instanced geometry

Use one unit quad in an `InstancedBufferGeometry`. Instance attributes place the quad from renderer-neutral glyph bounds and locate its atlas sample. A dedicated unlit node material owns TSL nodes for:

- local glyph placement and atlas coordinates;
- optional orientation and cylindrical curvature transforms;
- RGBA channel selection and signed-distance coverage;
- derivative-based edge smoothing;
- per-glyph color and material opacity; and
- rectangular clipping.

The visual fixture contains separate panels or instances that make each behavior observable without implementing stroke, outline, blur, lighting, or arbitrary material derivation. The design prefers `MeshBasicNodeMaterial` inputs where they are sufficient and uses a more general node material only if the pinned API requires it.

### Validate stable properties instead of exact cross-device pixels

Render at fixed canvas, camera, device-pixel-ratio, clear color, and object coordinates. Save a reference frame for human inspection, but gate automation on tolerant structural observations: non-empty expected regions, transparent background regions, separated colors/channels, clipped coverage, transformed bounds, curved placement, and bounded edge-transition samples.

An exact whole-image hash was rejected because antialiasing and derivative results can vary slightly across GPU implementations. Broad screenshot tolerances alone were also rejected because they can hide channel-selection or update failures; targeted pixel and region observations provide clearer diagnostics.

### Exercise in-place updates after the first completed frame

After the initial render, mutate one atlas channel, mark the texture for update, mutate selected instance attributes, mark those attributes for update, and render another completed frame. Assertions compare targeted regions and require the second frame to reflect both mutations while untouched instances remain stable.

Atlas allocation and growth remain outside scope. If the pinned Three revision cannot upload an in-place `DataTexture` mutation predictably, the report records the failure and tests texture replacement as a bounded alternative rather than silently expanding into a full atlas implementation.

### Make ownership and disposal explicit

The experiment owns and disposes its geometry, material, texture, renderer, browser DOM nodes, and browser-test context. Tests repeat creation, rendering, updating, and disposal at least once to expose obvious lifecycle errors. This is lifecycle validation, not a memory benchmark.

### Treat the report as the promotion gate

Write `docs/validation/webgpu-rendering-seam.md` with exact reproduction commands, environment, observations, limitations, failed assumptions, and a recommended production contract. Update `ROADMAP.md` and `ARCHITECTURE.md` only from demonstrated results. Passing the experiment does not automatically promote code; the later production change chooses which minimal parts to move into `@webgpu-text/three`.

## Risks / Trade-offs

- **Headless Chromium exposes no usable WebGPU adapter** → Document the required launch environment, fail rather than accept WebGL fallback, and retain a visible-browser command for a supported local reference machine.
- **Three.js exposes backend identity only through an unstable diagnostic** → Isolate the check to the experiment, pin the revision, and record the coupling instead of leaking it into the production API.
- **GPU rasterization varies across machines** → Assert tolerant semantic regions and targeted samples; keep screenshots as review evidence rather than exact universal hashes.
- **The synthetic atlas is too simple to exercise real SDF edges** → Include straight, diagonal, curved, and narrow features across the four channels while keeping generation outside runtime scope.
- **Curvature or clipping expands the spike** → Implement only the minimal uniform-driven transforms needed to prove the TSL hook; omit polished public controls and optimization.
- **TSL could also run through Three's WebGL backend** → State that portability is incidental, reject fallback during validation, and add no WebGL-specific tests or support promises.
- **Pinned Three APIs change immediately afterward** → The evidence remains revision-specific; upgrade validation becomes an explicit future task rather than assuming compatibility.

## Migration Plan

1. Add the private experiment to the workspace with an exact Three dependency and browser-test tooling.
2. Add synthetic atlas and instance fixtures plus pure fixture-integrity checks.
3. Implement the minimal instanced geometry and TSL material.
4. Add actual-WebGPU browser rendering, semantic frame assertions, update checks, and disposal checks.
5. Record the validated contract and update architecture/roadmap statements from evidence.
6. Run clean-install workspace validation and strict OpenSpec validation.

Rollback is deletion of the private experiment and its spike-only dependencies. The report may remain as a record of a rejected renderer assumption; no public package depends on the experiment.

## Open Questions

- Which public or isolated diagnostic in Three.js 0.185.1 most reliably proves that `WebGPURenderer` selected its WebGPU backend?
- Which Chromium launch configuration provides a reproducible WebGPU adapter on the required local and CI reference environments?
- Do the pinned node-material inputs provide clipping and curvature cleanly, or should either behavior become a bounded follow-up after the core SDF seam is proven?

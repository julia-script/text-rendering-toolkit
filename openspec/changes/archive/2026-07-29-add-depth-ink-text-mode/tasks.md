## 1. Rendering: shared controls and layered materials

- [x] 1.1 Refactor `createGlyphNodeAssembly` in `packages/three/src/rendering.ts` to accept an optional pre-built `GlyphMaterialControls` set, minting uniforms only when none is supplied; existing `createGlyphMaterial` callers are unchanged
- [x] 1.2 Expose `fillAlpha` and `clipCoverage` (or a combined core-coverage node) from the assembly result for the layered creator to wire against
- [x] 1.3 Add `createLayeredGlyphMaterials(atlas, sharedAtlasGrid)` returning `{ coreMaterial, edgeMaterial, controls }`: core with flat-opacity select on `fillAlpha·clip ≥ 0.5`, `alphaTestNode` 1/255, `depthWrite: true`, `LessDepth`; edge with the complementary select of `visibleOpacity`, `depthWrite: false`
- [x] 1.4 Unit-test the layered creator in `packages/three/test/rendering.test.ts`: material flags (depth write/func, transparent, alpha test), shared controls object identity across both materials, `updateGlyphMaterial` reaching both passes through the one controls set

## 2. Text: option, child mesh, lifecycle

- [x] 2.1 Add `depthInk` to `TextOptions` in `packages/three/src/types.ts` and read it in the `Text` constructor through the guarded option path: boolean check, reject `depthInk && lit` with `InvalidTextInputError` before any resource creation
- [x] 2.2 In `depthInk` construction, build the layered materials, keep the core material on `this`, and add an internal child `Mesh` sharing `this.geometry` with the edge material; `frustumCulled = false`, explicit `renderOrder` core < edge
- [x] 2.3 Keep visibility, instance-count, and appearance commits in `sync()` consistent across both passes (shared geometry makes counts free; verify visibility toggles reach the child)
- [x] 2.4 Dispose both materials exactly once in `dispose()`; shared `TextResources` untouched for other borrowers

## 3. Behavior tests

- [x] 3.1 `packages/three/test/text.test.ts`: default and `depthInk: false` construction produce the existing single-material mesh with no child pass
- [x] 3.2 Construction rejection tests: non-boolean `depthInk`, and `depthInk: true` with `lit: true`
- [x] 3.3 Sync/dispose tests for a depth-ink text: one `sync()` commits both passes, disposal releases geometry and both materials once, resources survive for other borrowers
- [x] 3.4 Rendering-seam validation: overlapping-ink deduplication at partial opacity (no darker seam) and depth occlusion of geometry behind core ink. (Amended during apply: this repo has no runnable GPU harness — the `webgpu-rendering-seam-validation` spec dir is an empty placeholder and all `packages/three` tests are headless object-state tests. Pass wiring is asserted structurally in 1.4/3.1–3.3; the pixel-level scenarios are covered downstream by effect-motion's Dawn-based headless spec tests, change `adopt-text-rendering-toolkit` task 5.3.)

## 4. Release

- [x] 4.1 Document `depthInk` in the three-webgpu README (what it buys, the fill-only core rule, the lit restriction)
- [x] 4.2 Add a minor-release changeset for `@text-rendering-toolkit/three-webgpu` (0.3.0)

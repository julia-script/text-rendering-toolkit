## 1. Complete the renderer-neutral layout contract

- [x] 1.1 Add required finite positive `fontUnitScale` data to resolved shaped runs and positioned glyphs, including public types and input validation.
- [x] 1.2 Preserve each run's `fontUnitScale` unchanged through glyph placement, wrapping, alignment, anchoring, and returned `LayoutResult` data.
- [x] 1.3 Update all synthetic fixtures, public-font translations, package examples, and layout tests to supply and assert the scale contract without changing accepted placement behavior.
- [x] 1.4 Update the layout README and clean-package type consumer to document `LayoutResult` as a self-sufficient renderer handoff.

## 2. Decouple the Three adapter from text policy

- [x] 2.1 Replace `TextOptions.input` and mutable `Text.input` with completed `LayoutResult` input named `layout`, and update committed-state typing for the new boundary.
- [x] 2.2 Remove runtime layout invocation, resolved-run lookup, font-facts scaling, selection delegation, and the obsolete pre-synchronization selection error from `@webgpu-text/three`.
- [x] 2.3 Narrow `TextFont` to lazy outline access and build every glyph quad from positioned layout data plus its `fontUnitScale`.
- [x] 2.4 Preserve promise coalescing, latest-layout atomic commits, failure recovery, atlas reuse/growth, appearance updates, empty layout behavior, and idempotent disposal in deterministic renderer tests.
- [x] 2.5 Update the renderer README and clean-package consumer to show external layout preparation and direct layout-package selection queries.

## 3. Migrate repository consumers and evidence

- [x] 3.1 Update the public Three WebGPU example to create `LayoutResult` through the public layout API before constructing and updating `Text`.
- [x] 3.2 Update the actual-WebGPU production fixture to consume completed real-font layouts while preserving multi-cell atlas, semantic rendering, update, fallback-rejection, and repeated-disposal evidence.
- [x] 3.3 Update architecture, roadmap, and validation documentation so all diagrams and examples identify `LayoutResult`—not Three—as the end of text preparation and the input to any renderer.

## 4. Verify the breaking handoff

- [x] 4.1 Run focused layout and Three package tests, type checks, builds, and packed clean-consumer validation.
- [x] 4.2 Run the full workspace Biome, TypeScript, Vitest, and build commands without `old/` dependencies.
- [x] 4.3 Run the public real-font browser fixture on an actual WebGPU adapter and record updated machine-readable and visual evidence.
- [x] 4.4 Validate the OpenSpec change strictly and confirm no raw-text preparation, lighting, new renderer, or compatibility overload entered the implementation.

## 1. Workspace and application shell

- [x] 1.1 Add `apps/docs` as a private TypeScript workspace with pinned compatible Next.js, React, Fumadocs, MDX, and Tailwind dependencies and local `@webgpu-text` workspace dependencies.
- [x] 1.2 Extend the root workspace, scripts, Turbo outputs, Biome inputs, and ignore rules so docs development, build, type-checking, and generated files participate correctly in repository workflows.
- [x] 1.3 Configure the Fumadocs MDX source, App Router root and docs routes, shared styles, metadata, and a minimal `WebGPU Text` documentation shell.
- [x] 1.4 Copy the minimal Latin and Arabic demonstration font fixtures into application-owned public assets with their license and attribution files.

## 2. Learning structure and initial content

- [x] 2.1 Create the Fumadocs navigation metadata, landing page, and getting-started page with an installation-to-first-layout learning path.
- [x] 2.2 Add a renderer-neutral pipeline explanation and one guide for each of the font, layout, SDF, and Three.js packages.
- [x] 2.3 Link contributor architecture, roadmap, and validation evidence from appropriate pages without duplicating their detailed content into MDX.

## 3. Font and layout vertical slice

- [x] 3.1 Add application-local example presentation and font-loading code with loading, error, cancellation, and font-handle disposal behavior.
- [x] 3.2 Implement an editable Latin-and-Arabic layout inspector using only public font and raw-text layout APIs, presenting segments, lines, selected fonts, and positioned glyphs without Three.js or WebGPU.
- [x] 3.3 Add the layout example page and explanatory content that makes font-byte ownership and the renderer-neutral handoff explicit.
- [x] 3.4 Validate the layout example and HarfBuzz WASM loading through the default Next.js development and production builds; resolve the public asset boundary without private source imports and document any required supported-bundler fallback.

## 4. CPU SDF example

- [x] 4.1 Implement a glyph selector that requests an outline lazily, generates an SDF through the public CPU API, and paints the bitmap to a two-dimensional canvas with localized loading and error states.
- [x] 4.2 Add the SDF example page explaining how outline lookup and bitmap generation remain independent of Three.js and WebGPU.

## 5. Three.js WebGPU example

- [x] 5.1 Add a dynamically loaded, client-only Three.js example boundary with WebGPU feature detection and a clear unsupported-browser state.
- [x] 5.2 Implement the WebGPU text scene through the public raw-text and Three.js APIs with cancellation-safe initialization, resizing, animation, and complete resource disposal.
- [x] 5.3 Add the Three.js example page explaining the renderer handoff and keeping GPU-specific code out of the font, layout, and SDF examples.

## 6. Verification and handoff

- [x] 6.1 Run the repository formatting, linting, type-checking, test, and production-build workflows with the docs application included, and fix scoped failures.
- [x] 6.2 Browser-smoke the layout and SDF examples without WebGPU, the Three.js unsupported state, and an actual WebGPU rendering path where available; verify remounting does not duplicate persistent work.
- [x] 6.3 Document local docs commands, browser prerequisites, the verified WASM/bundler behavior, asset licensing, deferred deployment selection, and the intentionally excluded search/versioning/editor features.

## Why

The font engine is now production-ready, but the next layer is still represented by Troika's 538-line `typeset()` monolith, where font resolution, shaping, wrapping, bidi placement, styling, interaction geometry, and renderer data are intertwined. Before implementing `@webgpu-text/layout`, the project needs an executable description of the layout policy it intends to preserve so that HarfBuzz shaping differences and legacy renderer coupling are not mistaken for layout regressions.

## What Changes

- Define the proposed renderer-neutral layout input and output boundary, including positioned glyph references, lines, bounds, carets, selections, and font identity without outlines, SDFs, atlases, or Three.js state.
- Add a deterministic synthetic shaped-run fixture model that tests layout mathematics independently of HarfBuzz glyph selection and font-file revisions.
- Capture accepted policy fixtures for newlines, whitespace, soft and hard wrapping, overflow behavior, letter spacing, line metrics, alignment, justification, anchoring, bidi placement, style/font runs, fallback, carets, selections, and bounds.
- Add a smaller pinned-font integration matrix proving that bidi/script/font itemization can compose with `@webgpu-text/font` while retaining UTF-16 source ranges.
- Record each observed Troika behavior as preserved, intentionally changed, or deferred rather than blindly snapshotting the old renderer-oriented output.
- Update architecture and roadmap documentation to close the repository-foundation milestone and identify the validated layout contract as the input to the subsequent production layout change.
- Do not implement the production layout engine, URL fetching, workers, SDF generation, atlas allocation, or rendering in this change.

## Capabilities

### New Capabilities

- `layout-policy-validation`: Defines the deterministic fixture evidence, proposed renderer-neutral contracts, behavior classification, and completion criteria required before implementing the production text-layout engine.

### Modified Capabilities

None.

## Impact

- Adds committed layout fixtures, fixture schemas, and test harnesses under the workspace's layout and test-fixture areas.
- Establishes proposed TypeScript layout contracts that the later `@webgpu-text/layout` implementation must satisfy.
- Reads the ignored Troika checkout only as a reference and fixture oracle; production code and committed tests remain independent of `old/`.
- Exercises the public `@webgpu-text/font` entry point for bounded integration evidence without changing its API.
- May add a renderer-neutral bidi dependency to the layout workspace only if the design proves it is required for the validation harness.

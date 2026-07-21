## Why

`@webgpu-text/layout` now has accepted renderer-neutral contracts and executable policy fixtures, but it still cannot produce a layout. The next useful step is a deterministic production core that turns already-resolved shaped runs into positioned glyphs, lines, bounds, carets, and selections without prematurely coupling layout to font fetching or Unicode itemization choices.

## What Changes

- Promote the draft resolved-run and layout-result types into documented production contracts, refining explicit paragraph direction and bidi-level data where visual ordering requires it.
- Add a synchronous pure `layoutResolvedText()` API that validates resolved input and implements the accepted line construction, wrapping, metrics, alignment, justification, anchoring, bidi placement, bounds, and caret policies.
- Promote selection rectangle derivation from validation support into a production pure helper over `LayoutResult`.
- Make the committed synthetic policy corpus execute against the production implementation and retain public-font integration checks at the shaped-run boundary.
- Keep the package strict-TypeScript, ESM-only, deterministic, DOM-free, renderer-free, and independent of `old/`.
- Explicitly defer automatic bidi/script itemization, Unicode line-break discovery beyond the accepted policy, font selection/fallback orchestration, workers, outlines, SDFs, atlases, and Three.js integration. Font-byte acquisition remains caller-owned rather than a future core-library responsibility.

## Capabilities

### New Capabilities

- `text-layout-core`: Pure resolved-run text layout, production result contracts, deterministic interaction geometry, input validation, and fixture conformance.

### Modified Capabilities

None.

## Impact

- `packages/layout` gains its first production layout API and conformance tests.
- Existing draft types receive focused breaking refinements before publication; no external compatibility is required at version `0.0.0`.
- `test-fixtures/layout` remains the normative policy oracle and may gain narrowly focused bidi-level evidence without importing legacy implementation code.
- `@webgpu-text/font` remains a test/integration dependency through its public exports; the layout algorithm does not own or dispose font handles.
- No new runtime dependency is planned for this slice.

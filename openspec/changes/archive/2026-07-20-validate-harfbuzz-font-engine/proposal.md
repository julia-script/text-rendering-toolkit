## Why

HarfBuzzjs is the selected font and shaping engine, but the greenfield project has not yet proven that its published ESM/WASM package satisfies the browser, worker, font-format, cluster, outline, and lifecycle needs of the future `font` package. Resolving those risks now prevents the full font and layout port from being built on assumptions about WASM loading, complex-script output, compressed fonts, or allocation behavior.

## What Changes

- Add a bounded strict-TypeScript, ESM-only validation harness for the published HarfBuzzjs package without implementing the production `font` package.
- Exercise shaping across Latin ligatures and kerning, Arabic, Indic, Khmer, combining marks, astral characters, and mixed-direction run inputs.
- Prove that shaped clusters can be represented as JavaScript UTF-16 source indices suitable for later caret and selection mapping.
- Attempt lazy numeric outline extraction without an SVG round-trip; if the published wrapper cannot expose drawing callbacks, record the rejected assumption and the smallest acceptable follow-up boundary.
- Measure and document WASM artifact/startup behavior, font-byte copying, reusable buffer behavior, repeated-shaping memory stability, and worker initialization/termination.
- Test TTF, OTF, WOFF, and WOFF2 inputs and decide whether v1 can accept them directly, needs bundled decoding, should expose decoder adapters, or should initially require normalized input.
- Record whether the published wrapper is sufficient or a narrower project-owned bridge is justified, then update the roadmap and architecture with the evidence-backed decision.
- Keep Troika and Typr outside the runtime; use them only as attributed behavioral references where comparison is useful.

## Capabilities

### New Capabilities

- `font-engine-validation`: Defines the executable evidence and recorded decisions required before implementing the HarfBuzz-backed font package and integrating it with text layout.

### Modified Capabilities

None.

## Impact

- Adds HarfBuzzjs and only the minimal tooling needed to run the validation harness in Node and a browser/ESM-worker context.
- Adds redistributable, provenance-recorded font fixtures and deterministic shaping/outline observations.
- Adds a validation report and updates `ROADMAP.md` and `ARCHITECTURE.md` with confirmed contracts, supported input formats, lifecycle guidance, and any remaining risks.
- Does not add a public npm package, production font API, layout integration, SDF generation, Three.js dependency, or WebGPU rendering code.

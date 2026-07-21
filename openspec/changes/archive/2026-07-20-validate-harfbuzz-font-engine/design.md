## Context

The repository currently contains planning documents and OpenSpec artifacts but no production workspace or font package. The preserved Troika checkout under ignored `old/` uses a generated Typr build plus project-owned shaping logic; the new architecture instead selects HarfBuzzjs and deliberately gives up exact compatibility with that partial shaper.

HarfBuzzjs is a new runtime dependency with an asynchronous ESM/WASM initialization path. Its public wrapper can shape UTF-16 text and query font facts, but the validation found that published 1.4.0 exposes glyphs only through SVG-string convenience methods. It also copies font bytes into WASM memory, allocates temporary text storage and JavaScript result objects, relies on garbage-collection finalizers for wrapper lifetime, and ships a stripped `HB_TINY` build. Compressed font support and real-browser worker loading were not sufficiently documented for this project to treat them as settled before the experiment.

This change is therefore an executable experiment and decision record. It must close the font-engine questions before production package scaffolding or layout integration starts.

## Goals / Non-Goals

**Goals:**

- Prove the published HarfBuzzjs package in Node and a real-browser ESM worker.
- Validate the provisional `FontHandle`, `ShapedRun`, and numeric `GlyphOutline` boundaries with representative scripts and fonts.
- Establish UTF-16 cluster semantics suitable for later caret and selection work.
- Determine direct and normalized support for TTF, OTF, WOFF, and WOFF2.
- Characterize artifact size, startup, buffer reuse, repeated-shaping memory behavior, and worker termination.
- Produce reproducible observations and explicit decisions that update the roadmap and architecture.

**Non-Goals:**

- Building or publishing the production `font` package.
- Implementing paragraph bidi analysis, font fallback, line breaking, wrapping, carets, or selection.
- Matching Troika or Typr glyph-for-glyph when HarfBuzz produces different valid shaping.
- Generating SDFs, creating an atlas, rendering through Three.js, or using WebGL/WebGPU.
- Forking HarfBuzzjs, adding custom WASM exports, or optimizing allocations during the spike unless the published wrapper cannot demonstrate a required capability.
- Creating a general font-table inspection, editing, or writing API.

## Decisions

### Keep the spike isolated and explicitly private

Place the executable harness under `experiments/harfbuzz-font-engine/` with a private manifest and the minimal strict-TypeScript/ESM tooling required for automated Node and real-browser checks. Shared redistributable font inputs belong under `test-fixtures/fonts/harfbuzz-validation/`, and the durable human-readable result belongs at `docs/validation/harfbuzz-font-engine.md`.

The experiment must not export a public package or import from `old/`. Useful contract types or fixture cases can be promoted deliberately by the later production change; no experiment path becomes public by accident.

Alternative considered: start directly in `packages/font`. Rejected because unresolved format and lifecycle decisions would turn experimental code into an implied production API and couple the spike to package naming and workspace choices that remain open.

### Evaluate the published wrapper before designing a replacement

Pin an exact HarfBuzzjs release and record both the wrapper version and embedded HarfBuzz revision. Use the supported `Blob`, `Face`, `Font`, `Buffer`, shaping, font-fact, variation, and glyph-drawing APIs. Do not reach through private Emscripten internals except for read-only memory observations that are clearly isolated in the harness.

The published wrapper is sufficient if it can initialize reliably, produce the required serializable results, reuse a shaping buffer, extract numeric outlines, and remain memory-stable enough for persistent worker use. A narrower bridge is recommended only when the report identifies a concrete blocker or measured hot-path cost that cannot be addressed through ordinary wrapper use.

Alternatives considered:

- Port the Typr-derived backend first: rejected because it makes the project own partial shaping solely to avoid evaluating the selected engine.
- Combine HarfBuzz with OpenType.js or Fontkit immediately: rejected because HarfBuzzjs already exposes the facts and outlines needed by v1; a second parsed font representation needs an independently demonstrated use case.
- Fork or rebuild HarfBuzzjs up front: rejected because `HB_TINY` or wrapper limitations must be observed before custom maintenance is justified.

### Validate directional script runs, not whole paragraphs

The shaping matrix supplies explicit text, direction, script, language, features, and variation coordinates. Latin cases cover kerning and ligatures; Arabic covers joining and marks; Indic and Khmer cover reordering and complex positioning; additional cases cover combining sequences and supplementary-plane characters.

Mixed-direction text is split into explicit directional runs by the harness. This demonstrates the integration boundary without pretending HarfBuzz replaces the future text-layout package’s paragraph bidi algorithm. Accepted observations pin glyph IDs, UTF-16 clusters, advances, and offsets to the exact engine and fixture versions rather than claiming universal glyph numbers.

### Keep source indices in UTF-16 code units

The experiment adds JavaScript strings through the HarfBuzzjs UTF-16 path and treats returned clusters as code-unit offsets. Each case verifies that clusters reference valid source boundaries and derives source ranges from adjacent cluster values while accounting for right-to-left order and many-to-one or one-to-many shaping.

The report must call out where a cluster is not a caret position. Later layout work will combine these ranges with script-aware caret policy; the spike proves only that the source mapping survives the engine boundary.

Alternative considered: normalize outputs to Unicode scalar indices. Rejected because JavaScript strings, selection offsets, and the preserved layout API use UTF-16 indexing; converting at every boundary would add cost and ambiguity.

### Require direct numeric outlines and reject an SVG round-trip

The intended production boundary uses HarfBuzz glyph drawing callbacks to accumulate provisional structure-of-arrays data:

```ts
interface GlyphOutline {
  commands: Uint8Array // move, line, quadratic, cubic, close opcodes
  coordinates: Float32Array
  bounds: { xMin: number; yMin: number; xMax: number; yMax: number }
}
```

The exact opcode values are private to the experiment. Published `harfbuzzjs@1.4.0` did not expose the drawing callbacks required to build this value. Its `glyphToJson()` implementation calls `glyphToPath()`, constructs an SVG string, and reparses it. The experiment therefore rejects that convenience method, throws an explicit unsupported-capability error from the candidate direct-outline operation, and uses the SVG round-trip only as diagnostic evidence that both TrueType and CFF glyphs are reachable.

The bounded follow-up is a HarfBuzzjs release with its upstream direct drawing API or the smallest upstreamed typed callback bridge. The production contract remains numeric, lazy, and variation-aware; this spike does not fork the WASM build or add a second font parser.

Alternative considered: keep SVG path strings as the cross-package outline contract. Rejected because they add formatting, parsing, and allocation between the font and SDF layers.

### Separate conformance observations from performance observations

Deterministic checks fail on incorrect initialization, shaping snapshots, source-boundary violations, invalid font facts, malformed outlines, cache behavior, or unexpected format handling. Performance and lifecycle observations record raw and compressed distributable sizes, cold initialization, warm shaping throughput, JavaScript/WASM memory samples, buffer reuse, and worker termination.

The memory loop warms the engine, then shapes a fixed corpus repeatedly with persistent font objects and one cleared/reused buffer. It records WASM memory pages and available JavaScript heap signals at fixed intervals. Monotonic unbounded growth is a failing observation; noisy garbage-collected heap values are reported rather than converted into a false precision threshold.

Worker termination is the deterministic whole-engine cleanup boundary for the browser experiment. The report separately records the published wrapper’s direct-object cleanup semantics so the future main-thread/Node API does not promise deterministic disposal that the dependency cannot provide.

### Treat font-format support as an output of the experiment

Exercise TTF and CFF-flavored OTF plus equivalent WOFF and WOFF2 samples where licensing permits. Record whether HarfBuzzjs accepts each directly and whether failures are explicit and diagnosable. If normalization is required, evaluate its deployment size and API shape without adding it to the production runtime in this change.

The report chooses one v1 policy: direct bundled support, optional decoder injection, or normalized TTF/OTF input. It may choose different policies for WOFF and WOFF2.

### Preserve fixtures and results as evidence

Every font fixture receives source, license, derivation notes, and SHA-256 metadata. Machine-readable observations include environment, package versions, fixture hashes, inputs, and outputs. The human report summarizes results, limitations, decisions, and reproducible commands.

`ROADMAP.md` and `ARCHITECTURE.md` are updated only after the evidence exists. Questions resolved by the spike move to decisions; genuinely unresolved risks remain explicit and become scoped follow-up work rather than hidden TODOs.

## Risks / Trade-offs

- **Fixture licenses or file sizes make the matrix impractical** → Prefer OFL or similarly redistributable fonts, use the smallest representative files, record derivations, and download-by-hash only when committing a fixture is not permitted.
- **Results vary when HarfBuzzjs updates its embedded engine** → Pin the package and fixture hashes; snapshots describe the selected version and require intentional review on upgrade.
- **Browser heap measurements are noisy or unavailable** → Treat WASM page growth and repeatability as primary signals and label JavaScript heap figures as observational.
- **The wrapper hides cleanup or zero-copy controls** → Record that limitation and use worker termination as the deterministic boundary; recommend a custom bridge only if a production requirement cannot otherwise be met.
- **A format decoder dominates bundle size** → Measure it separately and allow v1 to require normalized input instead of silently absorbing a large dependency.
- **The spike grows into production implementation** → Keep the experiment private, time-boxed, and complete once its report closes or explicitly rejects the listed assumptions.

## Migration Plan

1. Add the isolated private experiment and pin the dependency/tool versions.
2. Add licensed fixtures and provenance metadata before snapshotting results.
3. Implement the smallest HarfBuzz adapter needed for font facts, run shaping, UTF-16 clusters, and lazy numeric outlines.
4. Add Node conformance checks, repeated-run observations, and a real-browser ESM-worker smoke path.
5. Execute the format and script matrices and commit machine-readable observations.
6. Write the decision report and update the roadmap and architecture from its findings.
7. Validate the OpenSpec change and all documented reproduction commands.

Rollback is deletion of the private experiment and its spike-only dependencies. Fixture provenance and the validation report may remain useful historical evidence; no public package or runtime consumer depends on the experiment.

## Open Questions

This change is responsible for closing the following questions:

- Which of TTF, OTF, WOFF, and WOFF2 can v1 accept directly, and what decoder boundary is justified for the rest?
- Is the published HarfBuzzjs wrapper sufficient, or is a narrower result/outline/lifecycle bridge justified by evidence?
- What cleanup contract can the future `FontHandle` truthfully expose in a worker, browser main thread, and Node process?
- Do the provisional `FontHandle`, `ShapedRun`, and numeric `GlyphOutline` contracts need revision before production implementation?

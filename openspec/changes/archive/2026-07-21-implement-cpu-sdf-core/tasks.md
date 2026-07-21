## 1. Provenance and Reference Evidence

- [x] 1.1 Audit the published `webgl-sdf-generator@1.1.1` tarball, record its npm shasum/integrity and the exact CPU/path functions being adapted, and confirm the upstream copyright and MIT terms.
- [x] 1.2 Add package-local third-party notices and the complete upstream MIT license, update the root notice, and add concise provenance headers to every substantially adapted implementation file.
- [x] 1.3 Define a committed synthetic SDF fixture manifest covering line, quadratic, cubic, asymmetric orientation, multiple contours, holes/winding, padding, clipping, empty/degenerate geometry, and multiple exponents.
- [x] 1.4 Capture reviewed reference bytes from the pinned upstream CPU implementation with explicit derivation metadata while ensuring ordinary fixture generation and tests require neither the upstream package nor `old/`.

## 2. Public Contracts and Validation

- [x] 2.1 Add and export `SdfOutline`, `SdfViewBox`, `GenerateSdfInput`, and `SdfBitmap` types using numeric typed arrays and explicit required raster/encoding options.
- [x] 2.2 Add and export `InvalidSdfInputError` plus a synchronous `generateSdf(input)` entry point without adding a production dependency.
- [x] 2.3 Validate positive safe dimensions, allocatable pixel count, finite ordered view-box coordinates, positive finite distance/exponent, supported typed arrays, and input immutability before allocation.
- [x] 2.4 Validate command opcodes, exact coordinate consumption, finite coordinates, move/draw/close sequencing, and contour state with stable field-specific errors.
- [x] 2.5 Add invalid-input tests for every public validation class, including allocation overflow and proof that failure does not mutate or retain caller-owned arrays.

## 3. Numeric Outline Flattening

- [x] 3.1 Implement private numeric command iteration for move, line, quadratic, cubic, and close operations without constructing or parsing path strings.
- [x] 3.2 Port the pinned fixed quadratic/cubic sampling policy, preserve endpoints exactly, close valid contours, and discard zero-length segments consistently.
- [x] 3.3 Produce deterministic segment records and ordering needed by nearest-distance and winding scans without exposing a general path API.
- [x] 3.4 Add focused flattening tests for open/closed contours, consecutive moves, exact curve samples, multiple contours, reversed winding, and degenerate commands.

## 4. CPU SDF Kernel

- [x] 4.1 Port absolute point-to-segment distance and sorted candidate short-circuiting from the attributed CPU source.
- [x] 4.2 Port non-zero winding classification across complete geometry, including contours partially or fully outside the view box and reversed inner contours.
- [x] 4.3 Implement row-major texel-center sampling with row zero mapped to the view-box bottom edge.
- [x] 4.4 Implement the accepted exponential signed-distance encoding, midpoint rounding, byte clamping, and inside/outside saturation.
- [x] 4.5 Return fresh pixels and copied self-describing metadata, with deterministic all-outside output for empty or fully degenerate outlines.
- [x] 4.6 Add analytic kernel tests for exact distance, edge midpoint, saturation, orientation, clipping, winding, holes, and output ownership.

## 5. Conformance and Font Integration

- [x] 5.1 Build a conformance harness that runs every synthetic fixture through public `generateSdf()` and compares the complete `SdfBitmap` metadata and bytes.
- [x] 5.2 Add deterministic fixture regeneration checks and documented analytic intent for each golden case so pixel snapshots remain reviewable.
- [x] 5.3 Add `@webgpu-text/font` as a test-only workspace dependency and pass representative public line/quadratic/cubic glyph outlines directly through the structural SDF seam.
- [x] 5.4 Verify public-font integration through invariants and repeated equality without making revision-specific real-font pixel bytes the normative policy oracle.
- [x] 5.5 Record a bounded CPU timing observation for representative synthetic and real-glyph inputs without establishing a premature performance budget.

## 6. Package and Boundary Verification

- [x] 6.1 Add source-boundary checks rejecting `old/`, the upstream runtime package, font/layout runtime imports, workers, DOM/canvas, WebGL/WebGPU, Three.js, atlas, and renderer modules.
- [x] 6.2 Add a clean packed-package test proving ESM runtime and TypeScript exports work without another workspace package or browser global.
- [x] 6.3 Update the SDF package manifest to ship declarations, implementation, README, notices, and license while retaining zero production dependencies.
- [x] 6.4 Update the package README with the complete unit/orientation/encoding contract, a minimal numeric-outline example, font-outline interoperability, error behavior, and explicit non-goals.

## 7. Project Handoff and Full Verification

- [x] 7.1 Update `ARCHITECTURE.md` and `ROADMAP.md` to mark only the CPU SDF core implemented and keep workers, atlas ownership, GPU generation, caching, and renderer orchestration as explicit follow-ups.
- [x] 7.2 Run deterministic fixture regeneration, formatting, typechecks, all package tests/builds, package installation, provenance and forbidden-import audits, and the full suite with `old/` hidden.
- [x] 7.3 Run `openspec validate implement-cpu-sdf-core` and `openspec validate --all`, resolve every failure, and leave all task checkboxes and artifacts ready for archive.

## Why

An audit of the published error surface found seven inputs that escape three
packages as a raw `TypeError` or a caller's own `Error` instead of the package's
documented error type. Every one has the same shape: the entry point
dereferences its argument before validating it, so `null`, `undefined`, or a
throwing getter fails inside the function body rather than at its boundary.

This already contradicts a shipped requirement. `cpu-sdf-core` states that
generation MUST reject malformed input "with a public `InvalidSdfInputError`
before allocating or returning a partial bitmap" — but `generateSdf(null)`
throws `TypeError: Cannot read properties of null (reading 'width')`. Callers
following the documented contract and catching `InvalidSdfInputError` do not
catch it.

Fixing it now, before these packages see wider adoption at `0.1.1`, keeps the
public error contract honest while the change is still additive: each leak
becomes the error type the docs already promise, so no documented behavior is
broken.

## What Changes

- **`@text-rendering-toolkit/sdf`** — `generateSdf` validates that its argument
  is a non-null object, and reads each field exactly once into a local before
  validating, so a throwing getter or `Proxy` surfaces as
  `InvalidSdfInputError` rather than escaping. Closes 3 of the 7 leaks.
- **`@text-rendering-toolkit/three-webgpu`** — the `Text` and `TextResources`
  constructors reject a non-object `options` with `InvalidTextInputError`, and
  snapshot `options` fields once before validation. Closes 3 leaks.
- **`@text-rendering-toolkit/font`** — `loadFont` reports a detached
  `ArrayBuffer` as `InvalidFontError` instead of letting the allocation's
  `TypeError` escape. Closes 1 leak.
- Regression tests pin each converted input to its documented error type, so a
  future refactor that reintroduces an early dereference fails the suite.

Not breaking: every affected input throws today, and each keeps throwing. Only
the error *type* changes, from an undocumented one to the one already published
in each package's TSDoc. `InvalidSdfInputError` and `InvalidTextInputError` both
extend `TypeError`, so a caller catching `TypeError` is unaffected.

## Capabilities

### New Capabilities

None. This corrects conformance with requirements that already exist.

### Modified Capabilities

- `cpu-sdf-core`: The "Validate the production boundary" requirement gains a
  scenario for non-object input and for input whose property access throws,
  making explicit that argument-shape rejection precedes any field read.
- `three-webgpu-text-core`: The "Expose a layout-result Three text mesh" and
  "Expose reusable text renderer resources" requirements gain scenarios
  covering a non-object constructor `options`.
- `font-engine-core`: The "Load owned font handles from byte sources"
  requirement gains a scenario for a detached `ArrayBuffer`, which its existing
  "Decouple caller byte lifetime" scenario does not cover — that scenario
  addresses bytes released *after* loading resolves, not a buffer already
  detached when `loadFont` is called.

## Impact

- `packages/sdf/src/generate.ts` — `generateSdf` entry and `validateInput`.
- `packages/three/src/text.ts` — `Text` constructor option reads.
- `packages/three/src/resources.ts` — `TextResources` constructor option reads.
- `packages/font/src/input.ts` — `copyAndClassifyFont` byte copy.
- Tests in `packages/{sdf,three,font}` covering the converted inputs.
- TSDoc `@throws` tags on the four affected entry points, which currently omit
  these cases.
- No dependency, build, or public type-signature changes. `packages/layout` is
  untouched: its font-boundary leaks were already fixed under the
  `code: 'font-error'` contract.

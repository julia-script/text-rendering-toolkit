## Context

Seven inputs escape three packages as an undocumented error. All share one
shape: the entry point reads a field off its argument before establishing that
the argument is an object.

```ts
// packages/sdf/src/generate.ts
export function generateSdf(input: GenerateSdfInput): SdfBitmap {
  const pixelCount = validateInput(input)   // ← reads input.width immediately
```

Confirmed by executing each case against the built packages:

| Entry point | Input | Actual | Documented |
| --- | --- | --- | --- |
| `generateSdf` | `null` / `undefined` | `TypeError` | `InvalidSdfInputError` |
| `generateSdf` | missing or `null` `outline` | `TypeError` | `InvalidSdfInputError` |
| `generateSdf` | throwing getter / `Proxy` | caller's `Error` | `InvalidSdfInputError` |
| `new Text` | `null` / `undefined` | `TypeError` | `InvalidTextInputError` |
| `new Text` | throwing getter | caller's `Error` | `InvalidTextInputError` |
| `new TextResources` | `null` | `TypeError` | `InvalidTextInputError` |
| `loadFont` | detached `ArrayBuffer` | `TypeError` | `InvalidFontError` |

The `three` package already models the fix internally: `resources.ts` wraps
foreign calls with `invalid(message, cause)`. The gap is at the argument
boundary, not the dependency boundary.

`packages/layout` is out of scope — its font-boundary leaks were closed
separately under `code: 'font-error'`.

## Goals / Non-Goals

**Goals:**

- Every input in the table throws the error type its package already documents.
- Preserve the original failure as `cause` where one exists, so detail is not lost.
- One regression test per converted input, pinned to the error *type*.
- Update the `@throws` tags on the four entry points to cover these cases.

**Non-Goals:**

- No runtime schema validator or shared validation dependency.
- No new public error classes; the three existing ones suffice.
- No change to any input that already throws correctly, and no change to messages
  or field-level validation order beyond what the guard requires.
- No cross-package "utils" package (see Decisions).
- Not fixing `new Text({})` throwing nothing — deferring validation to `sync()`
  is existing, plausibly intentional behavior, and changing it is a separate
  decision.

## Decisions

### Duplicate a three-line guard per package rather than share one

Each package gets its own local guard, throwing its own error type:

```ts
// packages/sdf/src/generate.ts
function assertObject(input: unknown): asserts input is GenerateSdfInput {
  if (typeof input !== 'object' || input === null) {
    fail('input must be an object')
  }
}
```

Alternative considered: a shared `@text-rendering-toolkit/internal` package.
Rejected — `sdf` advertises zero production dependencies and independent
installability, which a shared runtime import breaks. The duplicated logic is
one `typeof` check; the coupling cost exceeds the duplication cost.

### Snapshot fields once, then validate the snapshot

A throwing getter is not fixed by a null check — validation must also stop
reading the same property repeatedly. `generateSdf` currently reads
`input.width` in validation and again in the sampling loop, so a getter can
throw *after* validation passes, or return different values on each read.

Destructure once inside a `try`, convert any failure, then validate locals:

```ts
let fields: GenerateSdfInput
try {
  const { outline, viewBox, width, height, distance, exponent } = input
  fields = { outline, viewBox, width, height, distance, exponent }
} catch (error) {
  throw new InvalidSdfInputError(`input properties could not be read: ${message(error)}`, { cause: error })
}
```

This also removes a latent time-of-check/time-of-use bug independent of the
error type, which is the main reason to prefer it over a bare null guard.
Verified against the built package: a `width` getter returning `4` during
validation and `8` afterwards produces a bitmap sized for the *second* read.
The result is self-consistent (`pixels.length === width * height`), so nothing
crashes — it silently returns a raster of a size the caller never validated,
which is the harder failure to notice.

### Detect the detached buffer by attempting the copy

`copyAndClassifyFont` allocates from a caller-controlled length. Rather than
probe for detachment before copying — there is no stable predicate, and any
probe races the copy — wrap the existing copy and convert:

```ts
try {
  const view = source instanceof Uint8Array ? source : new Uint8Array(source)
  copy = new Uint8Array(view.byteLength)
  copy.set(view)
} catch (error) {
  throw new InvalidFontError('Font bytes could not be read; the buffer may be detached')
}
```

Alternative considered: `structuredClone`-based detachment probing. Rejected as
slower, allocation-heavy on every load, and still racy.

### Keep `cause` on converted errors

`InvalidTextInputError` already forwards `cause` — both `text.ts` and
`resources.ts` define `invalid(message, cause?)` helpers that pass
`{ cause }` through — so the Three work reuses them and needs no error-class
change.

`InvalidSdfInputError` currently passes only a message to `super`, so it needs
`{ cause }` plumbed through its constructor and its `fail()` helper. This
mirrors the `cause` support just added to `TextPreparationError` in the layout
package, keeping the convention consistent across the toolkit.

`InvalidFontError` takes only a message today. Rather than widen it, the
detached-buffer message states the likely cause, since the underlying
`TypeError` ("Cannot perform Construct on a detached ArrayBuffer") carries no
caller-specific detail worth preserving.

## Risks / Trade-offs

- **A caller catching the raw `TypeError` today stops matching.** → Both SDF and
  Three error types extend `TypeError`, so `catch (e) { if (e instanceof TypeError) }`
  still matches. Only code matching the exact constructor or message breaks, which
  no documented contract encouraged. `InvalidFontError` extends `Error`, not
  `TypeError`, so the detached-buffer case is the one genuine behavior change —
  called out in the changeset.
- **Snapshotting changes field read order, so messages may name a different
  field first.** → Tests assert error *type*, not message text; existing
  field-level tests are checked and updated where they assert ordering.
- **Duplication drifts across packages.** → Three copies of a `typeof` check,
  each covered by its own test. Acceptable versus a dependency that breaks the
  `sdf` independence guarantee.
- **`sdf` snapshot adds an object allocation per call.** → One small object
  against a call that allocates a full raster and runs an O(width×height×segments)
  loop; unmeasurable. Golden fixtures confirm output is unchanged.

## Migration Plan

Additive within each package, shippable independently and in any order. Ship as
a `patch` for `sdf` and `three` (conformance fix to a documented contract) and a
`minor` for `font` (the detached-buffer type genuinely changes). Rollback is a
per-package revert; no persisted state or cross-package coordination.

## Open Questions

- Should `new Text({})` validate at construction instead of deferring to
  `sync()`? Out of scope here, but worth a follow-up decision.

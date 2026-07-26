# Repository agent notes

## OpenSpec workflow

- Always sync a change's delta specs into the main specs before archiving it.
  Treat this as standing approval; do not ask whether to skip synchronization.

## Error handling

- **Every wrapped error passes the original as `cause`.** When converting a
  failure into one of this repo's error types, forward the original rather than
  copying its message and dropping it:

  ```ts
  // yes
  throw new InvalidSdfInputError('input properties could not be read', { cause: error })
  // no — the original is lost
  throw new InvalidSdfInputError(error.message)
  ```

  Public error classes therefore accept `ErrorOptions` (or a `cause` field) and
  forward it to `super`. This applies to every boundary: a dependency, a native
  API, a caller-supplied callback, or another package in this workspace.

- **A package's public API only throws that package's own error types.** Errors
  from a dependency or a sibling package are converted at the boundary, not
  allowed to escape — a caller should never have to import a package it does not
  depend on in order to write a `catch`. `@text-rendering-toolkit/layout`
  converts font-handle failures to `TextPreparationError` with
  `code: 'font-error'`; `@text-rendering-toolkit/three-webgpu` uses its
  `invalid(message, cause)` helpers.

- **Validate an argument's shape before reading any field from it.** Public
  entry points check that an argument is a non-null object, then read each field
  exactly once into a local before validating. Reading first means `null`,
  `undefined`, and throwing getters escape as a raw `TypeError`; reading a field
  twice lets a getter return one value to the validator and another to the code
  that uses it.

- **Document what is actually thrown, all the way to the edge.** Every `@throws`
  names a concrete error type. The set is *transitive*: a function's documented
  errors include everything that can reach a caller through it, not just the
  `throw` statements in its own body. There are no hidden errors — if it can
  come out of the call, it is documented on the call.

  Tracing an entry point means walking every layer beneath it:

  1. **Its own `throw` statements** — read the body.
  2. **Internal helpers it calls** — recurse into each, until you bottom out or
     reach a helper whose `@throws` you already trust.
  3. **Workspace packages it depends on** — a `@text-rendering-toolkit/*` error
     is still foreign to *this* package's callers.
  4. **Third-party dependencies** — check the dep's own types and docs for its
     error classes (`ZodError`, `AxiosError`, and so on).
  5. **Native and runtime APIs** — the ones that are easy to forget.
     `JSON.parse` throws `SyntaxError`; `new URL` and `fetch` throw or reject
     with `TypeError`; `decodeURIComponent` throws `URIError`; a typed-array
     allocation over a detached buffer throws `TypeError`; `Intl` constructors
     throw `RangeError`. If the code calls these unguarded, the caller sees them.

  A rejected promise counts as a throw: document it under `@throws` the same way
  and say it surfaces as a rejection.

  **Wrap rather than widen.** When the transitive set includes anything foreign
  — a dependency, a native API, a caller-supplied callback, a sibling package —
  do not document the foreign type and do not let it escape. Convert it at the
  boundary into one of this package's own error types, with the original as
  `cause`, and document only that type. An honest `@throws` list should be short
  and stable because the boundary is doing the work, not because errors were
  omitted:

  ```ts
  // The layout package's entry points can only ever throw TextPreparationError
  // or InvalidLayoutInputError, because every font-handle call is wrapped.
  function usingFont<T>(description: string, range: Range, call: () => T): T {
    try {
      return call()
    } catch (error) {
      if (error instanceof TextPreparationError) throw error
      throw new TextPreparationError('font-error', `${description}: ${messageOf(error)}`, {
        ...range,
        cause: error,
      })
    }
  }
  ```

  If a boundary is missing and the list would be long and unstable, add the
  boundary — that is the fix, not a longer `@throws` block.

  **Verify by executing, not by reading.** Reading a call chain is how you find
  candidates; running hostile inputs against the built package is how you know.
  Feed each entry point `null`, `undefined`, primitives, throwing getters,
  detached buffers, and disposed handles, and check that what comes out is the
  documented type. Assumptions about which errors escape are wrong often enough
  that an undemonstrated `@throws` is not worth writing.

# @text-rendering-toolkit/layout

## 0.2.0

### Minor Changes

- aca5e1a: Contain font handle failures inside the layout error contract.

  `layoutText` and `layoutPreparedText` previously let errors from
  `@text-rendering-toolkit/font` escape unwrapped — a typo in a style's variation
  axis or feature string surfaced as `InvalidShapingInputError`, and a handle
  disposed mid-layout surfaced as `DisposedFontHandleError`, neither of which the
  documented contract mentioned. Callers had to catch error types from a package
  they may not import.

  Every call into a caller-owned `FontHandle` — registry lookup, coverage test,
  shaping, and metrics — is now converted to a `TextPreparationError` with the new
  `code: 'font-error'`, with the original attached as `cause`. Branch on `code`
  and inspect `cause` when the underlying detail matters.

  `TextPreparationErrorCode` gains the `'font-error'` member, and
  `TextPreparationError` now accepts and forwards a `cause`.

### Patch Changes

- Updated dependencies [aca5e1a]
  - @text-rendering-toolkit/font@0.2.0

## 0.1.1

### Patch Changes

- Publish the coordinated package family with registry-safe internal dependency
  ranges.
- Updated dependencies
  - @text-rendering-toolkit/font@0.1.1

## 0.1.0

### Minor Changes

- Prepare the first coordinated public release of the Text Rendering Toolkit package family.

### Patch Changes

- Updated dependencies
  - @text-rendering-toolkit/font@0.1.0

---
'@text-rendering-toolkit/layout': minor
---

Contain font handle failures inside the layout error contract.

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

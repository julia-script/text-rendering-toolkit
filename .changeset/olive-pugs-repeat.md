---
'@text-rendering-toolkit/three-webgpu': patch
'@text-rendering-toolkit/sdf': patch
'@text-rendering-toolkit/font': minor
---

Report unusable arguments with each package's own error type.

`generateSdf`, the `Text` and `TextResources` constructors, and `loadFont` each
read a field off their argument before validating it, so `null`, `undefined`, a
primitive, or a throwing getter escaped as a raw `TypeError` — or as the
caller's own error — instead of the type each function documents. `generateSdf`
also read `width` and `viewBox` more than once, so a getter returning different
values could size a raster by a number that was never validated.

Each entry point now copies its argument once, up front, and reports anything
unreadable as `InvalidSdfInputError`, `InvalidTextInputError`, or
`InvalidFontError` with the original attached as `cause`. `loadFont` reports a
detached `ArrayBuffer` — or a view onto one — the same way.

Every error this toolkit wraps now carries the original as `cause`, including
two that previously discarded it: shaping failures raised by HarfBuzz, and font
loads that failed during parsing.

`@text-rendering-toolkit/font` is a `minor` because `InvalidFontError` extends
`Error` rather than `TypeError`: code catching `TypeError` around `loadFont` to
handle a detached buffer no longer matches. The SDF and Three errors both extend
`TypeError`, so callers catching that continue to match.

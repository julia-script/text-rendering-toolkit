# @text-rendering-toolkit/three-webgpu

## 0.3.0

### Minor Changes

- 0c09195: Add an opt-in `depthInk` construction option to `Text`. With `depthInk: true`,
  fully-covered fill ink renders in a depth-writing core pass at the flat string
  opacity — overlapping glyph ink blends exactly once per pixel with no darker
  seam on semi-transparent text, and text ink occludes depth-tested geometry
  behind it — while the antialiasing ring, outline, and shadow blend in a second
  pass without depth writes, keeping their gradients. Default behavior is
  unchanged. The mode is fixed at construction and unlit-only: combining it with
  `lit: true` throws `InvalidTextInputError`.

### Patch Changes

- @text-rendering-toolkit/layout@0.3.0
- @text-rendering-toolkit/sdf@0.3.0

## 0.2.0

### Patch Changes

- aca5e1a: Report unusable arguments with each package's own error type.

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

- Updated dependencies [aca5e1a]
- Updated dependencies [aca5e1a]
  - @text-rendering-toolkit/sdf@0.2.0
  - @text-rendering-toolkit/layout@0.2.0

## 0.1.1

### Patch Changes

- Publish the coordinated package family with registry-safe internal dependency
  ranges.
- Updated dependencies
  - @text-rendering-toolkit/layout@0.1.1
  - @text-rendering-toolkit/sdf@0.1.1

## 0.1.0

### Minor Changes

- Prepare the first coordinated public release of the Text Rendering Toolkit package family.

### Patch Changes

- Updated dependencies
  - @text-rendering-toolkit/layout@0.1.0
  - @text-rendering-toolkit/sdf@0.1.0

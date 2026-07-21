# CPU SDF fixtures

`fixtures.json` is the normative synthetic pixel-policy corpus for
`@webgpu-text/sdf`. It covers open lines, quadratic and cubic curves,
orientation, multiple contours and holes, padding, clipping, empty/degenerate
geometry, and exponential encoding.

The fixture generator contains an attributed, reference-only adaptation of the
CPU algorithm published in `webgl-sdf-generator@1.1.1`. It has no package
dependency, performs no network access, and does not read `old/`. The generated
document records the npm shasum/integrity and the intent of every case.

The reference clamps normalized distance before exponentiation. This is the
only intentional correction to the published CPU function and matches both its
documented saturation behavior and its WebGL shader for all positive exponents.

Regenerate from the repository root:

```sh
node test-fixtures/sdf/generate-sdf-fixtures.mjs
```

Real font outlines are integration evidence in package tests, not part of this
normative byte corpus.

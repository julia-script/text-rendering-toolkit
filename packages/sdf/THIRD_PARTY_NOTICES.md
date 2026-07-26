# Third-party notices for `@text-rendering-toolkit/sdf`

The CPU distance-field implementation in `src/generate.ts` is adapted from the
JavaScript path flattening and SDF generation functions published in
`webgl-sdf-generator@1.1.1`.

- Author and copyright: Copyright (c) 2021 Jason Johnston
- Repository: `https://github.com/lojjic/webgl-sdf-generator`
- npm version: `1.1.1`
- npm shasum: `3e1b422b3d87cd3cc77f2602c9db63bc0f6accbd`
- npm integrity: `sha512-9Z0JcMTFxeE+b2x1LJTdnaT8rT8aEp7MVxkNwoycNmJWwPdzoXzMh0BjJSh/AEFP+KPYZUli814h8bJZFIZ2jA==`
- License: MIT; see `LICENSE.webgl-sdf-generator.txt`

Adapted behavior includes fixed quadratic/cubic flattening, point-to-segment
distance, sorted candidate scanning, non-zero winding, texel-center sampling,
and exponential byte encoding. The SVG-like parser was replaced by the
project's typed numeric outline contract. The factory, WebGL, framebuffer,
canvas, worker-oriented, logging, and fallback code was not copied.

One intentional correction clamps normalized distance before exponentiation.
This matches the upstream WebGL shader and documented saturation behavior for
all positive exponents; the published JavaScript path otherwise produces
invalid far-distance values for even or fractional exponents.

Synthetic golden fixtures in `test-fixtures/sdf/` were captured from the pinned
CPU policy. They contain derived numeric observations, not redistributed source.

# Third-party notices

This repository contains or adapts third-party software and test fixtures. The
original copyright and license terms remain in force.

## HarfBuzz and HarfBuzzjs

`packages/font/src/internal/vendor/` contains the HarfBuzzjs 1.4.0 compiled ESM
wrapper, generated loader, and normal shaping WASM build. The compiled wrapper
has a narrow attributed patch for deterministic native-object disposal and
access to its existing WASM instance; the package's TypeScript adapter adds
direct numeric outline callbacks.

- HarfBuzzjs source revision: `e55f3ce887a1a5437d8e7a3a3730123c7a49a5f6`
- Embedded HarfBuzz source revision: `56feae4035bdd48f62ba2b8d8c16232d4d89b3a4`
- Embedded HarfBuzz version: 14.2.1
- HarfBuzzjs npm integrity: `sha512-3KrygnLb4ESsntxvxZA7RhJy2Ci47GdXWC8fl9HwPHNEOUDXUNv5M+x/TiBkXKjUz6jz/CRJOL2Ksgq8V3UdKw==`
- License: MIT; see `packages/font/src/internal/vendor/LICENSE`

The exact vendored-file hashes and modification notes are recorded in
`packages/font/THIRD_PARTY_NOTICES.md`.

## webgl-sdf-generator

`packages/sdf/src/generate.ts` adapts only the CPU path-flattening and signed
distance behavior from `webgl-sdf-generator@1.1.1`. SVG parsing, WebGL, canvas,
framebuffer, and worker-oriented code are excluded.

- Copyright: Copyright (c) 2021 Jason Johnston
- npm shasum: `3e1b422b3d87cd3cc77f2602c9db63bc0f6accbd`
- npm integrity: `sha512-9Z0JcMTFxeE+b2x1LJTdnaT8rT8aEp7MVxkNwoycNmJWwPdzoXzMh0BjJSh/AEFP+KPYZUli814h8bJZFIZ2jA==`
- License: MIT; see `packages/sdf/LICENSE.webgl-sdf-generator.txt`

Exact adapted behaviors and the intentional distance-clamping correction are
recorded in `packages/sdf/THIRD_PARTY_NOTICES.md`.

## Font fixtures

The validation fixtures under `test-fixtures/fonts/harfbuzz-validation/` come
from Google Fonts/Noto and Adobe Source Sans and are redistributed under their
recorded OFL-compatible terms. Sources, revisions, derivations, SHA-256 hashes,
and full license texts are recorded in that directory's `fixtures.json`,
`README.md`, and `licenses/` files.

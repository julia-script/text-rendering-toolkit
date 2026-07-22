# Third-party notices for `@webgpu-text/font`

## HarfBuzzjs 1.4.0

The internal runtime is derived from
[HarfBuzzjs](https://github.com/harfbuzz/harfbuzzjs), distributed under the MIT
license reproduced at `src/internal/vendor/LICENSE`.

- npm version: 1.4.0
- npm source revision: `e55f3ce887a1a5437d8e7a3a3730123c7a49a5f6`
- npm package integrity: `sha512-3KrygnLb4ESsntxvxZA7RhJy2Ci47GdXWC8fl9HwPHNEOUDXUNv5M+x/TiBkXKjUz6jz/CRJOL2Ksgq8V3UdKw==`
- embedded HarfBuzz revision: `56feae4035bdd48f62ba2b8d8c16232d4d89b3a4`
- embedded HarfBuzz version: 14.2.1

Vendored generated artifacts:

| File | SHA-256 |
|---|---|
| `src/internal/vendor/index.js` | `4a301b3fe935fb1a2c2f5bec8ff777e207b868ea1c47074b9a8a3fa568376143` |
| `src/internal/vendor/harfbuzz.js` | `d64d3aecca9424ee0d0ad2f98354f795e93b0dc512f14f6819e45b96ac521524` |
| `src/internal/vendor/harfbuzz.wasm` | `64c8f422b7d31120ab010da3bba7cc248bf721dcd8be331a5b17971b7897f4b9` |
| `src/internal/vendor/LICENSE` | `5d09767b2cc476f08028b56d9384dc45061c5a3e90f9ad966e44addc8d26c8b1` |

Local modifications are confined to the non-exported compiled wrapper
`src/internal/vendor/index.js` and TypeScript adapter
`src/internal/harfbuzz.ts`:

- the compiled wrapper unregisters finalizers during explicit destruction,
  copies temporary Unicode-set data before releasing it, and exposes its
  existing WASM instance only to the internal TypeScript adapter;
- the adapter exposes HarfBuzz's existing direct glyph-drawing callbacks as numeric
  operations without constructing or parsing SVG paths;
- together they add explicit idempotent destruction for blob, face, font,
  draw-function, callback, and buffer resources; and
- it retains only the operations required by the public font package.

The HarfBuzz C/C++ source and WASM binary are unmodified. A future HarfBuzzjs
release with equivalent direct-drawing and disposal APIs can replace this
adapter behind the package's public conformance tests.

## Noto Emoji validation fixtures

The repository's color-font conformance tests use a pinned Noto Emoji SVG corpus from revision `b960563a023fbd1337227bf2a8a2d5a91889a333`, compiled reproducibly into small validation fonts. The source artwork is Apache-2.0 licensed. These fixtures are not included in the published package; their manifest, hashes, derivation, and license are recorded under `test-fixtures/fonts/color-glyph-validation/`.

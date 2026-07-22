# Color glyph validation fixture notices

The unmodified SVG inputs used to generate the validation fonts come from
[`googlefonts/noto-emoji`](https://github.com/googlefonts/noto-emoji) revision
`b960563a023fbd1337227bf2a8a2d5a91889a333`. That source repository licenses
the selected SVG artwork and tools under the Apache License 2.0. The generated
fonts are renamed `ColorGlyphValidation`, contain only the corpus recorded in
`test-fixtures/fonts/color-glyph-validation/fixtures.json`, and are used solely
as validation evidence.

The fonts are generated with `nanoemoji 0.15.0`, also Apache-2.0 licensed. Run
`pnpm --filter @webgpu-text/color-glyph-boundary-experiment fixtures:acquire`
to verify every source hash and reproduce all four binaries.

Apache License 2.0: https://www.apache.org/licenses/LICENSE-2.0

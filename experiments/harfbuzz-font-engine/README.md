# HarfBuzz font-engine experiment

Private, disposable validation code for the HarfBuzzjs decision. This is not a
published package or the implementation of `@text-rendering-toolkit/font`.

```sh
npm install
npm run validate
```

Individual checks are available as `npm run typecheck`, `npm run
verify:fixtures`, `npm run test:node`, `npm run benchmark`, and `npm run
test:browser`. `npm run update:expected` deliberately replaces the pinned
shaping baseline and is not part of ordinary validation.

The experiment reads only the attributed fixtures under
`../../test-fixtures/fonts/harfbuzz-validation/`; it never imports the ignored
Troika checkout under `old/`.

The evidence-backed result is in
[`../../docs/validation/harfbuzz-font-engine.md`](../../docs/validation/harfbuzz-font-engine.md).

## 1. SDF argument boundary

- [x] 1.1 Add `{ cause }` support to `InvalidSdfInputError` in `packages/sdf/src/errors.ts`, forwarding options to `super`, and widen the `fail()` helper in `generate.ts` to accept an optional cause
- [x] 1.2 Add a non-object guard at the top of `generateSdf` in `packages/sdf/src/generate.ts` so `null`, `undefined`, and primitives throw `InvalidSdfInputError` before any field is read
- [x] 1.3 Snapshot `outline`, `viewBox`, `width`, `height`, `distance`, and `exponent` into locals inside a `try`, converting any property-access failure to `InvalidSdfInputError` with the original as `cause`
- [x] 1.4 Guard `outline` itself as a non-null object before `validateOutline` reads `commands`/`coordinates`
- [x] 1.5 Route the sampling loop and returned bitmap through the snapshotted locals rather than re-reading `input.*`, closing the time-of-check/time-of-use gap
- [x] 1.6 Add cases to `packages/sdf/test/boundary.test.ts` for `null`, `undefined`, a primitive, missing `outline`, `null` `outline`, a throwing getter, and a `Proxy`, each asserting `InvalidSdfInputError`
- [x] 1.7 Add a regression test asserting a getter that changes value between reads cannot alter the emitted raster size
- [x] 1.8 Update the `@throws` tag on `generateSdf` to cover non-object input and unreadable properties
- [x] 1.9 Run `pnpm --filter @text-rendering-toolkit/sdf test` and confirm the golden SDF fixtures are byte-identical

## 2. Three constructor boundary

- [x] 2.1 Add a non-object guard to the `Text` constructor in `packages/three/src/text.ts`, throwing via the existing `invalid()` helper before reading `options.resources`
- [x] 2.2 Snapshot the constructor options into locals inside a `try`, converting property-access failures with `invalid(message, cause)`
- [x] 2.3 Add the same non-object guard to the `TextResources` constructor in `packages/three/src/resources.ts`
- [x] 2.4 Add cases to `packages/three/test/text.test.ts` for `null`, `undefined`, a primitive, and a throwing getter, each asserting `InvalidTextInputError`
- [x] 2.5 Add cases to `packages/three/test/resources.test.ts` for `null` and `undefined` options
- [x] 2.6 Update the `@throws` tags on both constructors to cover non-object options
- [x] 2.7 Run `pnpm --filter @text-rendering-toolkit/three-webgpu test`

## 3. Font byte-source boundary

- [x] 3.1 Wrap the view construction and byte copy in `copyAndClassifyFont` in `packages/font/src/input.ts`, converting an allocation failure to `InvalidFontError` naming a likely detached buffer
- [x] 3.2 Confirm the guard does not mask existing rejections — `null`, non-buffer values, and short buffers must keep their current messages
- [x] 3.3 Add cases to `packages/font/test/font.test.ts` for a detached `ArrayBuffer` and a `Uint8Array` view onto a detached buffer, asserting `InvalidFontError`
- [x] 3.4 Update the `@throws` tag on `loadFont` in `packages/font/src/font.ts` to cover an unreadable byte source
- [x] 3.5 Run `pnpm --filter @text-rendering-toolkit/font test`

## 4. Verification and release

- [x] 4.1 Re-run the audit probe covering all seven inputs and confirm each throws its package's documented error type
- [x] 4.2 Confirm every converted error that has an underlying cause exposes it as `cause`
- [x] 4.3 Run `pnpm check` and confirm all packages pass biome, typecheck, and tests
- [x] 4.4 Add a changeset: `patch` for `sdf` and `three-webgpu`, `minor` for `font`, noting the detached-buffer type change as the one genuine behavior change
- [x] 4.5 Sync the three delta specs into `openspec/specs/` before archiving, per `AGENTS.md`

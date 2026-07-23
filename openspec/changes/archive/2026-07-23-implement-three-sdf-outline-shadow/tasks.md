## 1. Public appearance and paint planning

- [x] 1.1 Add and export nullable `TextOutline` and `TextShadow` appearance records, wire their constructor defaults and mutable `Text` fields into copied sync snapshots, and cover the public type/default surface.
- [x] 1.2 Implement a pure internal paint-plan validator for colors, opacity, layout-unit distances, per-glyph SDF-texel conversion, required-versus-available padding, and directional render bounds, with deterministic mixed-scale and failure tests.

## 2. Resource and instance metadata

- [x] 2.1 Add construction-fixed em-based `sdfPadding`, validate `TextFont.facts.unitsPerEm`, frame wide/narrow/mark glyphs consistently, and extend resource plans with the minimum ordinary-versus-COLR eligibility and encoded-distance metadata while proving that appearance does not change outline lookup, atlas keys, texture identity, or stable slots.
- [x] 2.2 Extend instanced geometry data and updates with the minimum distance/eligibility attributes required by paint nodes, preserve growth and shared-atlas behavior, and commit expanded renderer bounds without mutating `LayoutResult` geometry.

## 3. TSL material composition

- [x] 3.1 Refactor atlas-channel sampling into a reusable TSL path and implement per-instance nonlinear distance conversion, ordinary fill, outer outline, shifted softened shadow sampling, ordered alpha composition, and final clipping from one existing atlas slot.
- [x] 3.2 Wire nullable paint controls into both unlit and planar-lit material variants, include fill/outline but not the visual drop shadow in the lit scene-shadow mask, and add deterministic node/control/update/disposal coverage.

## 4. Atomic Text integration

- [x] 4.1 Integrate paint planning into `Text` build/commit so supported appearance coalesces and updates in place while malformed or excessive requests reject before geometry, material, layout-result, or shared-resource mutation and later valid sync recovers.
- [x] 4.2 Add ordinary Latin/Arabic, mixed font-size, clipping, shared unlit/lit borrower, transparent composition, and repeated appearance-update integration tests that assert one reused SDF resource and stable atlas slot.
- [x] 4.3 Add mixed and COLR-only fixtures proving ordinary glyphs receive outline/shadow, COLR v0 layers remain unchanged and do not create false padding failures, and blank glyphs stay resource-free.

## 5. Public consumption and documentation

- [x] 5.1 Update package exports, TSDoc, README scope/default/limit guidance, and the public example with independent fill, outline, and one drop-shadow controls plus an excessive-paint recovery example.
- [x] 5.2 Extend clean packed-package and strict ESM/TypeScript consumer checks to construct, update, synchronize, and dispose the new public appearance without workspace or private-module imports.
- [x] 5.3 Add an interactive docs example for ordinary-glyph outline and shadow that exposes width, offset, softness, colors, opacity, clipping, resource size, and the explicit COLR ordinary-only boundary.
- [x] 5.4 Refine the interactive docs into a focused ordinary-text paint playground, removing unrelated lighting, scene-shadow, clipping, shared-resource, motion, and COLR demonstrations while retaining those details in their dedicated documentation.
- [x] 5.5 Keep every interactive shadow-control combination within the demo resource's SDF budget and expose a visibly useful softness range without sacrificing glyph resolution.

## 6. WebGPU evidence and reconciliation

- [x] 6.1 Extend the production actual-WebGPU fixture to render shared unlit and planar-lit real Latin/Arabic text, record semantic fill/outline/shadow/edge/transparent pixels and bounds, prove stable texture/slots across appearance changes, and exercise rejection, recovery, clipping, COLR coexistence, and repeated cleanup.
- [x] 6.2 Run package tests, typechecks, lint/format checks, docs build, packed-consumer validation, and pinned actual-WebGPU evidence, then update the roadmap and architecture with only the verified production behavior and remaining COLR/blur limits.

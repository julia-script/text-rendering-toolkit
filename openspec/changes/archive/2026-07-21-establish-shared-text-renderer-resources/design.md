## Context

`@webgpu-text/three` currently gives every `Text` an `RgbaGlyphAtlas`. That was the smallest safe first implementation, but it means two text objects using the same `FontHandle`, glyph ID, variations, and SDF size still extract and rasterize that glyph twice and allocate separate CPU bytes and GPU textures. Troika avoided this duplication with package-global atlases, but hidden global ownership conflicts with this project's explicit lifetime rules and makes independent renderer contexts difficult to reason about.

The change is confined to the Three.js package. `LayoutResult` remains the complete renderer-neutral handoff, callers continue to own font handles, and the SDF package continues to return one-channel bitmaps without cache or GPU policy.

## Goals / Non-Goals

**Goals:**

- Allow multiple `Text` objects to reuse one glyph identity cache, SDF atlas, and stable Three texture.
- Make sharing and disposal explicit while keeping one-off `Text` construction convenient.
- Preserve per-text geometry, material, appearance, committed layout, and atomic synchronization.
- Keep already synchronized text valid when another text grows the shared atlas.
- Choose a public ownership abstraction that can later contain color-glyph resources without exposing the current SDF packing representation.
- Prove cross-object reuse deterministically and through the existing actual-WebGPU fixture.

**Non-Goals:**

- Color-font or emoji decoding and rendering.
- Unicode line-breaking or shaping changes.
- Atlas eviction, compaction, partial uploads, persistence, or cross-process sharing.
- Worker-backed shaping or SDF generation.
- Batched geometry or fewer draw calls.
- A global singleton, automatic resource registry, or reference-counted lifetime.
- Changes to font acquisition, layout, SDF encoding, lighting, shadows, or Three.js support range.

## Decisions

### Expose an opaque `TextResources` owner

`@webgpu-text/three` will export an explicitly constructed `TextResources` class. Its public name describes ownership rather than the current bitmap representation; atlas pixels, slot maps, textures, and TSL bindings remain package-private.

```ts
const resources = new TextResources({ sdfSize: 64 })

const heading = new Text({ layout: headingLayout, fonts, resources })
const label = new Text({ layout: labelLayout, fonts, resources })

await Promise.all([heading.sync(), label.sync()])

heading.dispose()
label.dispose()
resources.dispose()
```

A `Text` constructed without `resources` creates a private `TextResources` using its existing `sdfSize` option. Passing both `resources` and `sdfSize` is rejected because one resource owner has one fixed raster configuration. This preserves the simple path while making shared configuration unambiguous.

Alternatives considered:

- A package-global atlas was rejected because its lifetime, renderer affinity, test isolation, and disposal would be hidden.
- A public `SharedSdfAtlas` was rejected because it exposes an implementation detail and would poorly accommodate a future independent RGBA color-glyph atlas.
- Mandatory resource injection was rejected because it makes the one-text case unnecessarily ceremonial.

### Use explicit borrowing instead of reference counting

Object ownership follows one rule:

```text
private path: Text ──owns──► TextResources ──owns──► cache + atlas texture

shared path:  Application ──owns──► TextResources ◄──borrows── Text A, Text B
```

`Text.dispose()` always disposes its geometry and material. It disposes resources only when it created the private default. An injected `TextResources` is never disposed by a text. `TextResources.dispose()` is idempotent, releases the shared texture and CPU cache, and causes later dependent synchronization to reject predictably. Documentation requires disposing dependent text objects before their shared owner; no hidden reference count delays cleanup.

Reference counting was rejected because JavaScript object reachability is not renderer-resource ownership, and implicit last-user disposal becomes fragile around scene removal, failed synchronization, and application shutdown.

### Key reusable glyphs by resource-local font identity

`TextResources` assigns stable resource-local IDs through a `WeakMap<TextFont, number>`. The cache key combines font object identity, glyph ID, canonical variation coordinates, and the owner's fixed SDF size. Reusing the same font handle across text objects therefore reuses one outline, bitmap, view box, and slot. Independently loaded handles are intentionally distinct even when their bytes happen to match; hashing font bytes or exposing parser identities would widen lower-layer contracts for speculative reuse.

Non-drawing glyphs are cached as empty identities so repeated spaces and controls do not repeat outline work.

### Preserve plan-then-commit synchronization

Resource mutation remains transactional within each synchronous build window:

```text
Text snapshot
    │
    ▼
validate layout/fonts/appearance
    │
    ▼
resolve misses and create an immutable atlas plan
    │
    ▼
build complete geometry/material values
    │
    ▼
commit shared atlas + this Text state without an await boundary
```

Missing outlines, invalid SDF input, or validation errors occur before either the resource plan or the text state commits. JavaScript execution cannot interleave another text commit inside the final synchronous section. Shared cache additions are monotonic and slot identities remain stable across growth.

This does not introduce a general resource scheduler. Future asynchronous workers will need their own revision and cancellation design.

### Share atlas growth state with every material binding

All materials created against one `TextResources` bind the same stable `DataTexture` and resource-owned atlas-grid state. Growth replaces the texture image data on that stable texture and updates shared grid state in place. Therefore a previously synchronized text immediately samples the correct cells after another text grows the atlas; it does not need to synchronize again merely to learn new atlas dimensions.

Per-text opacity and clipping controls remain private material state. Geometry and material instances are not shared, so this change does not reduce draw calls or couple appearance updates.

Registering and manually notifying every live `Text` was rejected in favor of a shared binding because notification lists introduce another lifetime graph and can retain disposed objects.

### Keep the future color path structurally open but unimplemented

The public owner does not expose assumptions such as four SDFs per RGBA cell. Internally this change still owns exactly one monochrome SDF atlas. A later color-glyph change can add another resource lane and material binding behind `TextResources` while retaining the same application ownership boundary.

No generic glyph-representation union is introduced now; color-font requirements will determine that contract from pinned font evidence rather than speculation.

### Validate reuse separately from batching

Unit tests will observe outline/SDF call counts, slot stability, shared growth propagation, failure atomicity, private/shared disposal, and invalid configuration. A public example and packed consumer will construct multiple texts against one owner. The actual-WebGPU fixture will render two independently positioned texts sharing repeated glyphs, grow the atlas through one object, and verify that the other remains correct without resynchronization.

These checks prove eliminated glyph-resource duplication. They make no draw-call or frame-rate claim; batching remains a later measurement-driven change.

## Risks / Trade-offs

- **[Shared atlas growth affects every text using its texture]** → Keep texture identity and slot identities stable, update shared dimensions in place, and browser-test an older text after growth caused by another object.
- **[One failed text could partially pollute shared state]** → Preserve validation and immutable planning before a synchronous no-await commit.
- **[Disposing the owner before borrowers invalidates rendering]** → Document owner-last disposal, make disposal idempotent, and reject later synchronization with a stable public error.
- **[The cache grows for the owner's lifetime]** → Keep ownership explicit and disposal cheap; defer eviction until measured long-lived workloads establish a policy.
- **[Equivalent fonts loaded into separate handles do not share]** → Prefer safe object-identity keys; applications that want reuse should reuse their caller-owned font handles.
- **[A neutral owner name could invite unsupported assumptions about color emoji]** → Document that the first implementation contains only monochrome SDF resources and keep all representation details private.
- **[Sharing resources does not reduce draw calls]** → State the boundary clearly and benchmark before proposing batching.

## Migration Plan

The API is additive. Existing `new Text({ layout, fonts, sdfSize })` construction continues to create private resources and keeps its current disposal behavior. Multi-text consumers can construct one `TextResources`, pass it to each text, dispose the texts, then dispose the owner. Examples and documentation will demonstrate both paths.

Rollback consists of removing resource injection and returning all text objects to private resources; no serialized data, font contract, or layout result changes require migration.

## Context

The starting workspace was the upstream Troika monorepo, while the intended product is an independent, greenfield, TypeScript and ESM-only WebGPU text package. The original implementation remains valuable as tested reference material, but its repository history, packages, tooling, and compatibility constraints must not become the new project's foundation by accident.

This change establishes the project boundary and records the later porting strategy. It does not start the port.

## Goals / Non-Goals

**Goals:**

- Preserve the original checkout and its Git history locally for inspection.
- Make the workspace root a clean, independent Git repository.
- Prevent the preserved checkout from entering the new repository.
- Establish OpenSpec at the new root.
- Record a detailed, diagrammed roadmap and architecture reference for the eventual standalone package family.

**Non-Goals:**

- Copying, translating, or adapting Troika runtime source code.
- Selecting final WebGPU shader, atlas, binding, or public API designs.
- Supporting WebGL, CommonJS, or compatibility with Troika's published API.
- Creating package tooling or a runnable text renderer.

## Decisions

### Preserve the original repository under `old/`

Move the complete existing checkout, including its nested `.git` directory, into `old/`. This retains exact source state and history without relying on a network remote or a partial source copy.

Alternatives considered:

- Keep the existing repository and develop on a new branch: rejected because the new project should have independent history and no inherited monorepo assumptions.
- Delete the checkout after copying selected files: rejected because source selection has not happened yet and the original tests and history remain useful evidence.

### Ignore `old/` from the new root repository

The new root `.gitignore` excludes `/old/` along with generated output. No committed file in the new project may depend on paths inside `old/`; it is a local reference, not a vendored dependency.

Alternatives considered:

- Commit the old repository as a subtree or submodule: rejected because that would couple the greenfield project's source and lifecycle to the original repository.

### Start a fresh root repository and OpenSpec workspace

Initialize a new Git repository on `main` and a new OpenSpec workspace at the root. The first project history can therefore describe the new product directly.

### Keep implementation planning in `ROADMAP.md`

Use the root roadmap as the durable overview of the current architecture, target architecture, source-disposition decisions, flows, delivery horizons, non-goals, and unresolved questions. Keep the detailed module audit, package responsibilities, dependency rules, boundary contracts, and consumption examples in the linked `ARCHITECTURE.md` so the roadmap remains readable. Individual implementation increments can later become separate OpenSpec changes.

Alternatives considered:

- Make the entire port one OpenSpec change: rejected because it conflates the repository reset with a large, still-evolving implementation program.
- Put only a short task list in the roadmap: rejected because architectural diagrams and source-disposition rationale are needed to evaluate later changes in context.

### Publish independently consumable domain packages

Define four package boundaries: font parsing/shaping, renderer-neutral text layout, renderer-neutral SDF generation, and Three WebGPU rendering. The lower layers must be directly usable and must not depend on Three.js or higher layers.

Alternatives considered:

- Publish one package with internal modules or subpath exports: rejected because layout-only and SDF-only consumers should not acquire unrelated runtime dependencies, and independent package manifests make the dependency boundary enforceable.
- Create additional packages for workers, shared types, and atlas internals: rejected because those are execution or implementation boundaries rather than independently valuable consumer capabilities.

### Resolve outlines on demand

Keep vector outlines out of `LayoutResult`. The layout session resolves an outline asynchronously from a stable glyph reference only when a consumer asks for it. The renderer uses this path for atlas misses and caches the result.

Alternatives considered:

- Return all unique outlines eagerly: rejected because measurement, caret, selection, and non-vector consumers would pay unnecessary computation, transfer, and memory costs.
- Add an `includeOutlines` switch in v1: deferred because it adds a second result shape before a serialization use case exists.

### Keep atlas ownership in the Three renderer

End the SDF package at a one-channel `SdfBitmap`. The Three renderer owns atlas allocation, RGBA channel packing, growth, dirty tracking, cache policy, GPU upload, and disposal.

Alternatives considered:

- Publish a renderer-neutral atlas helper from the SDF package: rejected because atlas policy and lifecycle are driven by the renderer, and no independent atlas consumer is currently required.

### Preserve behavior through attributed internal backends

Begin with an internal Typr-derived font backend and a CPU-only derivation of `webgl-sdf-generator`, both behind new public contracts and protected by fixtures. Preserve upstream copyright and permission notices and add `NOTICE.md` when source is imported.

Alternatives considered:

- Adopt Fontkit immediately: deferred until fixtures can distinguish intentional improvements from regressions. Fontkit remains the leading comparison backend.
- Rewrite the CPU SDF encoder immediately: rejected because the MIT-licensed implementation can be reused with attribution and tested independently of its discarded WebGL path.

## Risks / Trade-offs

- **The ignored reference can diverge from upstream** → Record the preserved commit and treat `old/` as historical evidence, not a dependency.
- **Moving nested Git metadata can be confusing** → Verify the root and `old/` independently after the move.
- **A roadmap can be mistaken for approved implementation detail** → Label future structures and APIs as direction, keep open decisions visible, and use later OpenSpec changes for executable work.
- **Local deletion of `old/` would remove the convenient reference** → The new project must remain valid without it; the source can be restored separately if needed.

## Migration Plan

1. Move every original root entry, including `.git`, into `old/`.
2. Create the root ignore rules before tracking files so `old/` cannot be staged accidentally.
3. Initialize a new root Git repository on `main`.
4. Initialize OpenSpec in the new repository.
5. Write `ROADMAP.md` and `ARCHITECTURE.md` from inspection of the preserved `troika-three-text` package and its dependencies.
6. Verify the two Git boundaries, ignore behavior, documentation diagrams, and OpenSpec artifacts.

Rollback is local and straightforward until the new repository has unique history: remove the fresh root metadata and move the contents of `old/` back to the workspace root. The preserved nested repository remains untouched during normal execution.

## Open Questions

There are no unresolved decisions for this repository-and-documentation change. Product and architecture questions for the port remain listed in `ROADMAP.md` and are intentionally deferred to future changes.

## Why

The WebGPU text project needs a clean, independent foundation without losing access to Troika's tested implementation as a reference. Before porting begins, the repository boundary and the intended migration path must be made explicit and reviewable.

## What Changes

- Preserve the complete original Troika checkout, including its Git history, under an untracked `old/` directory.
- Initialize the repository root as a new, independent Git project and ignore the preserved checkout plus generated artifacts.
- Initialize a fresh OpenSpec workspace for the new project.
- Add a root `ROADMAP.md` that explains the original and proposed architectures, maps reusable source areas, diagrams the runtime and synchronization flows, and defines staged delivery horizons, non-goals, and open decisions.
- Add a companion `ARCHITECTURE.md` that audits current module responsibilities and defines independently consumable font, text-layout, SDF, and Three WebGPU renderer packages with explicit dependency and data-contract boundaries.
- Do not implement the WebGPU port as part of this change; the port is future work described by the roadmap.

## Capabilities

### New Capabilities

- `repository-foundation`: Defines the clean-project boundary while retaining the original repository as an ignored local reference.
- `project-roadmap`: Defines the required roadmap and architectural reference for the future TypeScript, ESM-only, WebGPU-only package family.

### Modified Capabilities

None.

## Impact

This change affects repository layout, Git metadata and ignore rules, OpenSpec planning files, and project documentation. It introduces no runtime package, public API, rendering implementation, or dependency choice.

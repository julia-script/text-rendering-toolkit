## MODIFIED Requirements

### Requirement: Prove isolated consumer use
The validator MUST install and exercise the complete tarball family in a temporary consumer outside the repository without linking package runtime code, declarations, or assets from the workspace.

#### Scenario: Resolve the packed dependency graph
- **WHEN** the isolated consumer installs all four local tarballs and their declared registry dependencies
- **THEN** its `@text-rendering-toolkit` runtime packages resolve from the installed tarballs
- **AND** Three.js resolves according to the renderer package's peer dependency contract

#### Scenario: Exercise public package handoffs
- **WHEN** the isolated consumer type-checks and executes its validation program
- **THEN** it can import the public ESM and TypeScript surfaces of all four packages
- **AND** it can load supplied font bytes through the packed HarfBuzz WASM asset
- **AND** it can prepare multilingual raw text through the renderer-neutral API
- **AND** it can generate an SDF through the public CPU API
- **AND** it can import or construct the public Three.js WebGPU integration without requiring a GPU

#### Scenario: Reject hidden workspace coupling
- **WHEN** any required package code, declaration, or runtime asset can only be resolved from the monorepo workspace
- **THEN** release-candidate validation fails instead of adding a workspace symlink or fallback

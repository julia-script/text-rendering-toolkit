## ADDED Requirements

### Requirement: Establish one canonical public identity
The project SHALL use Text Rendering Toolkit as its public display name,
`text-rendering-toolkit` as its repository identity, and
`@text-rendering-toolkit` as the npm scope for the package family.

#### Scenario: Inspect active project identity
- **WHEN** a contributor searches tracked active source, manifests, lockfiles, documentation, fixtures, and current specifications
- **THEN** project-owned identity references use Text Rendering Toolkit, `text-rendering-toolkit`, or `@text-rendering-toolkit` as appropriate
- **AND** archived OpenSpec changes may retain the temporary historical identity

### Requirement: Name each public package by its durable boundary
The public family SHALL consist of `@text-rendering-toolkit/font`,
`@text-rendering-toolkit/layout`, `@text-rendering-toolkit/sdf`, and
`@text-rendering-toolkit/three-webgpu`.

#### Scenario: Inspect renderer-neutral package names
- **WHEN** a consumer selects the font, layout, or SDF package
- **THEN** its package name does not imply a WebGPU dependency

#### Scenario: Inspect the Three.js adapter name
- **WHEN** a consumer selects the renderer package
- **THEN** its package name identifies both the Three.js integration and its WebGPU-specific boundary

### Requirement: Ship complete public package metadata
Each public package MUST declare a non-placeholder version, description,
license, repository and package-directory metadata, homepage, issue tracker,
search keywords, ESM exports, packed files, and public npm access, while the
root repository MUST provide a consumer-facing README and the selected project
license.

#### Scenario: Inspect a packed public package
- **WHEN** a public package is packed from the workspace
- **THEN** its manifest contains canonical metadata for `julia-script/text-rendering-toolkit`
- **AND** its archive contains its runtime, declarations, README, applicable license and notices, and no private workspace source or tests

#### Scenario: Keep non-public workspaces private
- **WHEN** Changesets and package assembly inspect the workspace
- **THEN** the root, documentation app, and examples remain private and cannot be published accidentally

### Requirement: Coordinate package-family versions
The repository SHALL use Changesets with the four public packages in one fixed
version group, public access, `main` as the base branch, patch internal
dependency updates, and default package changelogs.

#### Scenario: Version the first public family
- **WHEN** the release-preparation changeset is applied to packages at `0.0.0`
- **THEN** all four public packages become version `0.1.0`
- **AND** workspace dependency ranges and the lockfile resolve to the coordinated version

#### Scenario: Prepare a later package change
- **WHEN** a contributor records a valid changeset for any public package
- **THEN** the version plan keeps the fixed group aligned and records the release notes without custom project-owned versioning logic

### Requirement: Maintain canonical CI and release preparation
The public repository SHALL run its quality and release-candidate gates on a
GitHub-hosted workflow and SHALL use Changesets to maintain a version pull
request on `main`.

#### Scenario: Validate a repository change
- **WHEN** a relevant commit or pull request runs CI
- **THEN** the workflow installs the pinned workspace, runs the repository quality checks, and runs the complete packed release-candidate validation

#### Scenario: Update the version pull request
- **WHEN** unpublished changesets exist on `main`
- **THEN** the release workflow creates or updates one Changesets version pull request rather than editing versions manually

### Requirement: Create the canonical public repository
The verified local Git history SHALL be published as the public
`julia-script/text-rendering-toolkit` GitHub repository with `origin` pointing
to that repository and `main` as its default branch.

#### Scenario: Inspect the public repository
- **WHEN** a contributor clones the canonical GitHub repository
- **THEN** the existing project history, release preparation, current source, specifications, and workflows are available from `main`

### Requirement: Keep npm publication owner-controlled
Release preparation MUST document npm authentication recovery, trusted
publishing, provenance, publication ordering, and post-publication verification,
but MUST NOT publish an npm package merely by applying this change.

#### Scenario: Complete release preparation
- **WHEN** every implementation task and technical gate for this change passes
- **THEN** no `@text-rendering-toolkit` version has been published by the change
- **AND** the owner can separately authorize trusted-publisher setup and the first version release

#### Scenario: Prepare trusted publishing
- **WHEN** the owner configures npm to trust the canonical GitHub Actions workflow
- **THEN** the workflow uses short-lived OIDC credentials from a supported GitHub-hosted runner and package repository metadata matches the canonical public repository

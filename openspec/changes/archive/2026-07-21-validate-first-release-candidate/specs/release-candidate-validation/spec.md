## ADDED Requirements

### Requirement: Assemble one package-family candidate
The repository SHALL provide one explicit root command that builds and packs the font, layout, SDF, and Three.js packages as a single local release-candidate run without publishing them.

#### Scenario: Assemble a candidate from a clean build
- **WHEN** a developer runs the release-candidate command from the repository root
- **THEN** the command builds the current sources and produces one tarball for each of the four packages
- **AND** all four packed manifests report the same source version

#### Scenario: Preserve repository release state
- **WHEN** candidate assembly completes or fails
- **THEN** the source package manifests remain unchanged
- **AND** no package, tag, or release is published externally

### Requirement: Validate packed manifests and contents
The validator MUST inspect the package manifests and file inventories as packed rather than relying only on workspace source files.

#### Scenario: Audit public package boundaries
- **WHEN** the four tarballs have been assembled
- **THEN** each archive contains its declared ESM runtime and TypeScript declaration targets
- **AND** no packed runtime dependency uses the `workspace:` protocol
- **AND** workspace-only source and test files are absent

#### Scenario: Audit required assets and notices
- **WHEN** packed contents are inspected
- **THEN** the font archive contains its HarfBuzz WASM runtime and attribution
- **AND** the layout archive contains its runtime dependency notices
- **AND** the SDF archive contains the adapted generator attribution and license
- **AND** every package contains consumer-facing documentation appropriate to its public API

#### Scenario: Measure artifacts without speculative budgets
- **WHEN** packed contents pass their structural audit
- **THEN** the report records each archive's SHA-256 hash, compressed size, and unpacked file size
- **AND** validation does not impose an arbitrary package-size failure threshold

### Requirement: Prove isolated consumer use
The validator MUST install and exercise the complete tarball family in a temporary consumer outside the repository without linking package runtime code, declarations, or assets from the workspace.

#### Scenario: Resolve the packed dependency graph
- **WHEN** the isolated consumer installs all four local tarballs and their declared registry dependencies
- **THEN** its `@webgpu-text` runtime packages resolve from the installed tarballs
- **AND** Three.js resolves according to the renderer package's peer dependency contract

#### Scenario: Exercise public package handoffs
- **WHEN** the isolated consumer type-checks and executes its validation program
- **THEN** it can import the public ESM and TypeScript surfaces of all four packages
- **AND** it can load supplied font bytes through the packed HarfBuzz WASM asset
- **AND** it can prepare multilingual raw text through the renderer-neutral API
- **AND** it can generate an SDF through the public CPU API
- **AND** it can import or construct the public Three.js integration without requiring a GPU

#### Scenario: Reject hidden workspace coupling
- **WHEN** any required package code, declaration, or runtime asset can only be resolved from the monorepo workspace
- **THEN** release-candidate validation fails instead of adding a workspace symlink or fallback

### Requirement: Record machine-readable candidate evidence
Each release-candidate run SHALL produce a machine-readable report that identifies what was tested and separates technical validity from publication approval.

#### Scenario: Record candidate identity and environment
- **WHEN** validation completes
- **THEN** the report records the source commit and dirty state, aligned package version, Node and pnpm versions, operating environment, and the hashes and sizes of all four archives

#### Scenario: Record technical results
- **WHEN** a technical assembly, audit, install, type, or runtime check runs
- **THEN** the report records that check's pass or fail result
- **AND** the root command exits unsuccessfully when any required technical check fails

#### Scenario: Record unresolved publication gates
- **WHEN** the final package names, npm ownership, project license, public version, canonical repository metadata, registry access, or provenance policy remain undecided or unverified
- **THEN** the report lists each item as a blocked publication gate
- **AND** those owner-controlled gates do not misrepresent a passing technical candidate as approved for publication

### Requirement: Keep candidate artifacts out of source control
Generated tarballs and run reports MUST be written beneath an ignored release-candidate output directory, while temporary consumers and unpacked audit directories MUST be created outside the repository and removed after validation.

#### Scenario: Complete a validation run
- **WHEN** the validator writes candidate artifacts and evidence
- **THEN** Git does not offer those generated files for commit
- **AND** a later run can replace the local output without changing tracked sources
- **AND** no temporary consumer or unpacked audit directory remains in the repository

### Requirement: Document the manual release boundary
The repository SHALL document how to run and interpret release-candidate validation and the ordered manual steps that remain before an authorized npm publication.

#### Scenario: Interpret a technically valid candidate
- **WHEN** a contributor reads the release documentation after a successful technical run
- **THEN** they can locate the report, distinguish technical checks from publication gates, and understand that no publication occurred

#### Scenario: Prepare a later publication
- **WHEN** the owner authorizes a release after resolving all publication gates
- **THEN** the documentation identifies the required metadata, versioning, validation rerun, registry dry run, ordered package publication, and post-publication verification steps

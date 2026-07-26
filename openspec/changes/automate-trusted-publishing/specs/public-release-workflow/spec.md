## MODIFIED Requirements

### Requirement: Maintain canonical CI and release preparation
The public repository SHALL run its quality and release-candidate gates on a
GitHub-hosted workflow, SHALL use Changesets to maintain a version pull request
on `main`, and SHALL publish the package family from that same workflow once no
unpublished changesets remain.

#### Scenario: Validate a repository change
- **WHEN** a relevant commit or pull request runs CI
- **THEN** the workflow installs the pinned workspace, runs the repository quality checks, and runs the complete packed release-candidate validation

#### Scenario: Update the version pull request
- **WHEN** unpublished changesets exist on `main`
- **THEN** the release workflow creates or updates one Changesets version pull request rather than editing versions manually
- **AND** the workflow publishes nothing on that run

#### Scenario: Publish when the version pull request merges
- **WHEN** a push to `main` leaves no unpublished changesets
- **THEN** the release workflow runs the complete packed release-candidate validation before contacting the registry
- **AND** publishes every public package whose version is not already on the registry
- **AND** publishes in dependency order so a dependent package never resolves a version that does not yet exist

#### Scenario: Propagate release history to the repository
- **WHEN** a publish run completes successfully
- **THEN** the workflow pushes the version commit and one git tag per released package to the canonical repository

#### Scenario: Refuse to publish from an unvalidated run
- **WHEN** the repository quality checks or the packed release-candidate validation fail during a release run
- **THEN** the workflow fails without publishing any package

### Requirement: Keep npm publication owner-controlled
Merging the Changesets version pull request SHALL be the owner's authorization to
publish, and no other repository event SHALL publish a package. Release
documentation MUST cover npm authentication, trusted publishing, provenance,
publication ordering, and post-publication verification.

#### Scenario: Authorize a release
- **WHEN** the owner merges the Changesets version pull request
- **THEN** the release workflow publishes the coordinated package family
- **AND** no separate credential, manual dispatch, or local publish command is required

#### Scenario: Withhold authorization
- **WHEN** the version pull request remains unmerged
- **THEN** no `@text-rendering-toolkit` version is published
- **AND** ordinary pushes, pull requests, and CI runs publish nothing

#### Scenario: Prepare trusted publishing
- **WHEN** the owner configures npm to trust the canonical GitHub Actions workflow
- **THEN** the workflow uses short-lived OIDC credentials from a supported GitHub-hosted runner and package repository metadata matches the canonical public repository

## ADDED Requirements

### Requirement: Authenticate publication without a long-lived token
The release workflow SHALL authenticate to npm by exchanging a GitHub Actions
OIDC identity token for a short-lived, package-scoped registry credential, and
the repository MUST NOT store or reference a long-lived npm token.

#### Scenario: Exchange an identity token for registry credentials
- **WHEN** the release workflow publishes a package from a GitHub-hosted runner
- **THEN** the publishing tool requests an Actions identity token for the registry audience and exchanges it for a package-scoped registry token
- **AND** the workflow job is granted permission to request that identity token

#### Scenario: Keep credentials out of the repository
- **WHEN** a contributor inspects the repository and its workflows
- **THEN** no npm token, `.npmrc` credential, or token-backed publish path is present

### Requirement: Publish registry-safe workspace dependency ranges
Publication MUST convert each internal `workspace:` dependency range into a
published semver range that resolves from the registry.

#### Scenario: Inspect a published dependent package
- **WHEN** a consumer installs a published package that depends on a sibling package
- **THEN** its declared dependency is a semver range matching the coordinated released version rather than a `workspace:` range

### Requirement: Record and verify publication trust evidence
Every published version MUST carry provenance attestation established through
trusted publishing, and a release MUST NOT be reported as successful until that
evidence is confirmed on the registry.

#### Scenario: Attest a published version
- **WHEN** the release workflow publishes a version
- **THEN** the registry records that version as published by a trusted publisher with a provenance attestation

#### Scenario: Detect a silent authentication fallback
- **WHEN** the identity token exchange fails and the publishing tool falls back to other credentials
- **THEN** the release is treated as failed rather than successful, even if the publish command reported success

#### Scenario: Verify a release after publication
- **WHEN** a release run finishes
- **THEN** each published package is confirmed to expose the coordinated version, canonical repository metadata, public access, and its provenance attestation
- **AND** installing the family from the registry in a clean directory succeeds

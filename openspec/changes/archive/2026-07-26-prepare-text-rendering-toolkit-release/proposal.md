## Why

The four-package family is technically mature but still carries its temporary
WebGPU-wide identity, private placeholder manifests, no canonical public
repository, and no repeatable versioning or publication workflow. Preparing the
project as Text Rendering Toolkit now gives every layer an accurate searchable
identity and turns the existing release-candidate evidence into a practical
path to an intentional first public release.

## What Changes

- **BREAKING**: Rename the project and npm scope from WebGPU Text /
  `@webgpu-text` to Text Rendering Toolkit / `@text-rendering-toolkit`.
- **BREAKING**: Rename the renderer package from `@webgpu-text/three` to
  `@text-rendering-toolkit/three-webgpu`; rename the other public packages to
  `@text-rendering-toolkit/font`, `/layout`, and `/sdf`.
- Update active source, manifests, lockfiles, tests, fixtures, documentation,
  validation evidence, and current OpenSpec specifications to the new identity
  while preserving archived change artifacts as historical records.
- Add the minimum public-release metadata and documentation: a root README, a
  confirmed project license, package descriptions and keywords, canonical
  repository links, public access settings, and an initial coordinated `0.1.0`
  version.
- Add Changesets with the four public packages in one fixed-version group,
  default changelogs, and a small GitHub Actions workflow for CI and release
  pull requests.
- Remove the five private pre-production experiment workspaces and their
  experiment-only validation reports now that production package tests and the
  packed release-candidate validator cover the promoted behavior.
- Create the public `julia-script/text-rendering-toolkit` GitHub repository with
  `gh`, attach it as `origin`, and push `main`.
- Fix the two discovered release gates: make the documentation pipeline diagram
  accessible and raise the isolated consumer's explicit `sdfPadding` from
  `0.2` to `0.31`.
- Record the confusing SDF paint-padding ergonomics as later design work rather
  than redesigning the API during release preparation.
- Re-run the existing quality and packed-consumer evidence, but do not publish
  packages to npm as part of this change.

## Capabilities

### New Capabilities

- `public-release-workflow`: Defines the canonical public identity, repository,
  package metadata, coordinated versioning, CI, release preparation, and
  publication boundary for the four-package family.

### Modified Capabilities

- `font-engine-core`: Rename the standalone public font package.
- `text-layout-core`: Rename the public layout package and its public-font
  handoff references.
- `cpu-sdf-core`: Rename the public SDF package and structural font references.
- `three-webgpu-text-core`: Rename the Three.js WebGPU renderer package.
- `documentation-app`: Rebrand the project and update examples to the new
  package family.
- `layout-policy-validation`: Update real-font validation to the renamed public
  font entry point.
- `webgpu-rendering-seam-validation`: Update the public-package boundary to the
  new npm scope, then retire the superseded private validation capability.
- `browser-text-decoration-boundary-validation`: Retire the superseded private
  validation capability.
- `color-glyph-boundary-validation`: Retire the superseded private validation
  capability.
- `font-engine-validation`: Retire the superseded private validation
  capability.
- `lit-text-shadow-seam-validation`: Retire the superseded private validation
  capability.
- `text-preparation-validation`: Retire the superseded private validation
  capability.
- `release-candidate-validation`: Validate the renamed tarballs and resolve the
  now-selected package identity while retaining explicit owner-controlled
  publication gates.

## Impact

The change touches all active workspace manifests and imports, package READMEs
and notices, the documentation application, examples, release-candidate
tooling, the lockfile, current specifications, and repository metadata. It
removes five superseded private experiment workspaces, adds Changesets and
GitHub Actions as development/release tooling, creates one public GitHub
repository, and prepares four public npm packages without publishing them. The
renderer API remains behaviorally unchanged apart from its package import path;
the temporary consumer padding adjustment only makes the existing release
fixture satisfy the documented paint contract.

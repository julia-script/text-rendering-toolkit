## Why

The four packages now work together in the workspace and have individual pack tests, but that does not yet prove that one coherent, versioned release candidate can be installed and used outside the repository. Before choosing publication metadata or publishing to npm, the project needs a repeatable validation boundary that exposes packaging, dependency, asset, attribution, and consumer-facing gaps.

## What Changes

- Add a repeatable local process that builds and packs the font, layout, SDF, and Three.js packages as one versioned release candidate without publishing them.
- Validate the packed package family from clean consumers using only tarballs and declared registry dependencies, including ESM imports, TypeScript declarations, workspace dependency rewriting, the HarfBuzz WASM asset, renderer-neutral text preparation, and the Three.js entry point.
- Audit each tarball's contents, dependency metadata, version alignment, package size, and required attribution files, and record machine-readable evidence for the candidate.
- Document the smallest manual release path and clearly separate technical checks from owner-controlled gates such as the final package names, npm scope ownership, project license, repository URLs, credentials, and provenance policy.
- Keep every package private and perform no registry publication during this change.

## Capabilities

### New Capabilities

- `release-candidate-validation`: Defines how the package family is assembled, inspected, installed, exercised, and reported as a local first-release candidate without publishing it.

### Modified Capabilities

None.

## Impact

- Affects root release-validation scripts and commands, package tarball checks, clean-consumer fixtures, and release documentation.
- May expose package-manifest or shipped-file corrections needed for a valid candidate, but does not change the public text, font, SDF, or renderer APIs.
- Introduces no publishing service, release platform, or runtime dependency; existing pnpm, TypeScript, and Vitest tooling should be reused where practical.
- Leaves package naming, npm ownership, project licensing, and actual publication as explicit follow-up decisions rather than inferring them from third-party licenses or placeholder manifests.

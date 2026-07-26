## 1. Resolve Bounded Release Gates

- [x] 1.1 Confirm the project license and exact copyright-holder line before creating any project-owned license files.
- [x] 1.2 Raise the isolated release consumer's explicit `TextResources.sdfPadding` from `0.2` to `0.31` without changing its outline or shadow values.
- [x] 1.3 Give the labelled landing-page pipeline diagram valid accessible semantics and confirm the blocking Biome diagnostic is resolved.
- [x] 1.4 Add a roadmap follow-up to revisit SDF paint-capacity and padding ergonomics without expanding the current renderer API.

## 2. Rename the Active Project and Package Family

- [x] 2.1 Rename the root and all workspace package identities from `webgpu-text` / `@webgpu-text` to `text-rendering-toolkit` / `@text-rendering-toolkit`.
- [x] 2.2 Rename the public renderer package to `@text-rendering-toolkit/three-webgpu` while retaining the internal `packages/three` directory unless a build tool requires otherwise.
- [x] 2.3 Update active TypeScript imports, runtime strings, tests, examples, experiments, package filters, generated-input artifacts, and workspace dependency declarations to the new package names.
- [x] 2.4 Rebrand PITCH, ROADMAP, ARCHITECTURE, package READMEs and notices, validation documents, the docs application, and current examples as Text Rendering Toolkit.
- [x] 2.5 Update release-candidate package expectations, isolated-consumer imports and WASM paths, report identity, and publication-gate wording for the new scope and renderer name.
- [x] 2.6 Regenerate the pnpm lockfile and verify legacy identity references remain only in archived OpenSpec changes and main specs awaiting the required delta-spec sync.

## 3. Complete Public Package Metadata

- [x] 3.1 Add a concise root README that explains the four independently usable packages, their dependency direction, installation paths, current maturity, and link to detailed docs.
- [x] 3.2 Add the confirmed project license at the root and include the applicable license text in every public package archive alongside existing third-party notices.
- [x] 3.3 Add descriptions, license identifiers, repository directories, homepage, issue tracker, keywords, public access configuration, and complete packed-file lists to the four public manifests.
- [x] 3.4 Remove `private` only from the four public packages and verify the root, docs app, examples, and experiments remain unpublishable.
- [x] 3.5 Update the packed-package audits so every public tarball proves its canonical metadata, README, license, declarations, runtime, and required notices.

## 4. Add Coordinated Version Management

- [x] 4.1 Install `@changesets/cli` and add minimal root scripts for adding changesets, applying version plans, validating a candidate, and publishing an authorized release.
- [x] 4.2 Configure Changesets with public access, `main` as the base branch, patch internal dependency updates, default changelogs, and one fixed group containing the four public packages.
- [x] 4.3 Add and apply the initial release changeset so all four public manifests and changelogs reach coordinated version `0.1.0`, then refresh the lockfile.
- [x] 4.4 Verify Changesets ignores private workspaces, sees aligned public versions, and reports no unconsumed initial changeset after versioning.

## 5. Add Minimal GitHub Release Automation

- [x] 5.1 Add a Node 24 GitHub-hosted CI workflow that installs the frozen pnpm workspace and runs the repository check plus complete release-candidate validation.
- [x] 5.2 Add a Changesets workflow that creates or updates a version pull request on `main` without publishing packages automatically.
- [x] 5.3 Add a separately manual-dispatched publish workflow with `id-token: write` that reruns release validation before the authorized Changesets publish command.
- [x] 5.4 Document npm login recovery, first-publication bootstrapping, package publication order, trusted-publisher configuration for all four packages, provenance, and post-publication verification.
- [x] 5.5 Verify no npm token, credential, automatic publish-on-push path, docs deployment, release matrix, or custom changelog/publishing implementation was added.

## 6. Prove Local Release Readiness

- [x] 6.1 Run formatting and linting, then confirm `pnpm check` passes with no blocking diagnostics.
- [x] 6.2 Run the complete typecheck and test graph, including the actual-WebGPU browser evidence available on the development machine.
- [x] 6.3 Run the root build and complete packed release-candidate validator and confirm assembly, tarball audit, isolated install, consumer typecheck, consumer runtime, and source-manifest preservation all pass.
- [x] 6.4 Inspect the generated report and tarballs for aligned `0.1.0` versions, canonical package names, public metadata, hashes, sizes, required assets, licenses, notices, and absence of workspace protocols.
- [x] 6.5 Verify the working tree contains only the intended release-preparation changes and that delta specs cover every current-spec package-name change for mandatory sync before archive.

## 7. Publish the Repository, Not the npm Packages

- [x] 7.1 Reconfirm GitHub CLI is authenticated as `julia-script`, the target repository exists as an empty public repository, and `origin` is canonical.
- [ ] 7.2 Commit the verified release-preparation changes so the public default branch will contain the complete rename and workflow setup.
- [ ] 7.3 Verify the public `julia-script/text-rendering-toolkit` repository with GitHub CLI and push `main` through its canonical `origin`.
- [ ] 7.4 Verify repository visibility, canonical remote, default branch, README rendering, and the first GitHub Actions results.
- [ ] 7.5 Confirm no `@text-rendering-toolkit` package was published to npm and leave trusted-publisher activation and first publication for a separate explicit owner authorization.

## Context

The repository contains four independently packed packages with a proven
one-way dependency graph, but every workspace still uses the temporary
`@webgpu-text` identity. The public packages remain private at `0.0.0`, the
root has no README or selected license, there is no Changesets or GitHub Actions
configuration, and the local Git repository has no remote. The existing
release-candidate validator already builds, packs, audits, installs, typechecks,
and executes the complete tarball family outside the workspace.

The npm scope `text-rendering-toolkit` has been claimed. GitHub CLI is
authenticated as `julia-script`, and `julia-script/text-rendering-toolkit` does
not currently exist. The latest audit found two bounded technical failures:
one invalid ARIA label in the documentation landing page and one release
consumer whose explicit `sdfPadding: 0.2` is too small for its requested paint.

## Goals / Non-Goals

**Goals:**

- Give the project and every active workspace reference the canonical Text
  Rendering Toolkit identity.
- Publish the renderer-facing package under the honest
  `@text-rendering-toolkit/three-webgpu` name.
- Make the four public packages complete, licensed, searchable npm artifacts
  with coordinated `0.1.0` versioning.
- Reuse the existing release-candidate validator as the release technical gate.
- Add the smallest repeatable CI and Changesets release-PR workflow.
- Create and push the canonical public GitHub repository.
- Restore a clean quality gate and passing isolated consumer.
- Preserve the SDF padding contract for now while recording its ergonomics for
  later design work.

**Non-Goals:**

- Publishing any package to npm in this change.
- Redesigning `TextResources.sdfPadding`, automatically resizing SDF resources,
  or changing accepted paint validation.
- Deploying the documentation application to a separate hosting provider.
- Adding release matrices, custom changelog generators, custom publishing code,
  prerelease channels, independent package versions, or framework integrations.
- Rewriting archived OpenSpec changes to pretend the temporary identity never
  existed.

## Decisions

### Use one descriptive umbrella and one backend-specific adapter name

The project display name becomes **Text Rendering Toolkit**, the repository
becomes `text-rendering-toolkit`, and the npm scope becomes
`@text-rendering-toolkit`. Public package names are:

- `@text-rendering-toolkit/font`
- `@text-rendering-toolkit/layout`
- `@text-rendering-toolkit/sdf`
- `@text-rendering-toolkit/three-webgpu`

Only the adapter name mentions WebGPU because the lower three packages contain
no WebGPU dependency. `three-webgpu` also avoids implying compatibility with
Three.js `WebGLRenderer`. Alternative: retain `/three`. Rejected because the
current renderer contract is intentionally WebGPU-only and the package name can
state that boundary before installation.

### Perform one active-tree rename without compatibility aliases

All tracked active manifests, imports, tests, fixtures, docs, notices, generated
input artifacts, current OpenSpec specs, and lockfile entries change together.
Archived OpenSpec change directories remain unchanged as historical records.
No compatibility packages or re-export aliases are added because the old
packages have never been publicly released. After implementation, searches
outside the archive must find no project-identity use of `@webgpu-text`,
`webgpu-text`, or “WebGPU Text.”

Alternative: publish aliases under both scopes. Rejected because it creates a
migration burden for an identity that has no public consumers.

### Coordinate the first releases with one fixed Changesets group

Add only `@changesets/cli` and the standard Changesets Action. Configure the
four public packages as one fixed group, public access, `main` as the base
branch, patch internal dependency updates, and the default changelog generator.
The first version is `0.1.0`. Apps, examples, experiments, and the root remain
private and are not members of the group.

This trades extra package publishes for a much simpler initial compatibility
story: one version identifies one tested family. Independent versioning can be
adopted later only when release history demonstrates a need. Alternative:
manual version edits and recursive publishing. Rejected because Changesets
already handles internal dependency ranges, changelogs, and release pull
requests with less project-owned logic.

### Keep publication behind a separate explicit owner action

CI runs the normal repository check and release-candidate validation on the
canonical GitHub repository. One release workflow uses Changesets only to
maintain a version pull request; it never publishes merely because that pull
request is merged. A separate manual-dispatch workflow contains the future
validated publish command and can run only after an explicit owner action. This
change does not dispatch it or invoke npm publication. The release documentation
records npm login recovery, first-publication bootstrapping,
trusted-publisher configuration, required OIDC permissions, and
post-publication verification.

The workflow targets a GitHub-hosted Node 24 runner so it satisfies the current
npm trusted-publishing minimums. The package repository metadata must exactly
match `https://github.com/julia-script/text-rendering-toolkit`.

Alternative: store a long-lived npm write token immediately. Rejected in favor
of trusted publishing and short-lived OIDC credentials once the packages are
ready for an explicitly authorized publication.

### Create the canonical repository only after local verification

Implementation first completes the rename, metadata, workflows, and local
checks. It then uses GitHub CLI to create the public
`julia-script/text-rendering-toolkit` repository from the existing local
history, adds `origin`, and pushes `main`. This sequencing prevents the first
public state from being a knowingly broken intermediate rename.

The initial homepage may be the repository README. Documentation hosting is
deferred until it provides value beyond the existing buildable docs app.

### Treat the current SDF failure as a fixture correction

The isolated consumer intentionally exercises outline and shadow together. Its
explicit `sdfPadding: 0.3` provides `2.998669` layout units of safely encodable
paint room for the exercised font size, while the requested paint plus one
antialias texel requires `3.020000`. Raise only that fixture value from `0.2`
to `0.31` and retain the current paint values.

The renderer correctly rejected the request, so production validation and
defaults do not change. Add the broader question—how callers should size or
discover paint padding without manually reasoning in em units—to the roadmap
for a later bounded design change.

### Fix only the blocking accessibility error

Give the labelled visual pipeline diagram an appropriate semantic role so its
accessible name is valid. Do not fold the unrelated CSS specificity warnings
into release preparation; they are non-blocking and can be handled with future
docs maintenance if they cause an actual cascade problem.

## Risks / Trade-offs

- **A broad mechanical rename can miss embedded identifiers** → Search the
  active tree before and after, regenerate the lockfile, build generated docs,
  and exercise packed tarballs rather than trusting source manifests.
- **A fixed group republishes unchanged packages** → Accept this simplicity
  through the pre-1.0 period and revisit only with release-history evidence.
- **A publish workflow can make an irreversible external release** → Trigger it
  only by manual dispatch, rerun release-candidate validation in the job, and
  require explicit trusted-publisher setup before use.
- **The npm CLI is currently unauthenticated** → Treat login and registry trust
  configuration as owner-controlled publication gates, not reasons to weaken
  CI or commit credentials.
- **A public repository is externally visible and not rolled back by Git** →
  create it only after the local release gates pass; if pushing fails, retain
  the local verified state and continue rather than deleting history.
- **MIT or another license still needs an owner-approved holder line** → Stop
  license-file implementation until the owner confirms the license and exact
  copyright holder; do not guess legal identity.
- **The padding bump can hide API confusion** → Record the ergonomics question
  explicitly and avoid claiming that `0.31` is a universal recommendation.

## Migration Plan

1. Confirm the project license and copyright holder.
2. Rename the active workspace and public package identities in one change,
   including current specs and the lockfile.
3. Add package metadata, root documentation, licenses, and coordinated
   Changesets configuration.
4. Correct the two bounded quality/release fixtures and record the padding
   follow-up.
5. Add CI and release-PR workflows and document the publication boundary.
6. Run formatting/linting, typechecks, tests, build, package pack tests, and the
   complete release-candidate validator from a clean active tree.
7. Create the public GitHub repository, add `origin`, push `main`, and confirm
   CI observes the pushed commit.
8. Leave npm publication and trusted-publisher activation for a separately
   authorized release action.

Before the GitHub repository is created, rollback is an ordinary Git revert.
After creation, rollback means reverting the pushed commit while retaining the
public repository and its history; package publication is not involved.

## Open Questions

- Which license and exact copyright-holder line should be added? MIT is the
  recommended default because the preserved reference and adapted runtime code
  already use compatible permissive licenses, but the owner must choose it.
- Should the later SDF ergonomics work expose a paint-capacity query, derive
  resource sizing from an explicit appearance budget, or improve diagnostics
  without changing resource identity? This change records but does not answer
  that question.

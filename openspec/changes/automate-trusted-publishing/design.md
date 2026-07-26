## Context

The repository already has the two halves of a Changesets release, but they were never
joined:

```
  PR merged to main
        │
        ▼
  release-pr.yml ── changesets/action (version only) ──▶ "Version Packages" PR  [now publish.yml]
        │
        │  ...nothing connects these...
        ▼
  publish.yml ── workflow_dispatch ──▶ release:candidate ──▶ changeset publish
     contents: read          id-token: write
```

Current state, verified rather than assumed:

- Four packages are live at `0.1.1`, published by the documented manual bootstrap:
  interactive `npm login`, four serial `pnpm --dir packages/* publish`, and
  `NPM_CONFIG_PROVENANCE=false`.
- The registry confirms that bootstrap's shape. All four `0.1.1` versions expose
  `_npmUser: juliascript` with **no** `trustedPublisher` marker and **no**
  `dist.attestations.provenance`. Only ordinary registry signatures are present.
- A trusted publisher *is* nevertheless already configured on each package, pointing at
  `julia-script/text-rendering-toolkit` and workflow `publish.yml` with `npm publish`
  permission. It simply was not used for the `0.1.x` bootstrap, which is why those
  versions carry no trust evidence. The configured filename is what fixes this change's
  workflow name.
- The four `0.1.1` git tags exist and are pushed, but point at the hand-written release
  commit `f11101e`, not at automation output.
- Published dependency ranges are correct: `layout` depends on
  `@text-rendering-toolkit/font: ^0.1.1`, and `three-webgpu` on `^0.1.1` of `layout` and
  `sdf`. The `workspace:^` ranges in the source manifests were rewritten on the way out,
  which is direct evidence that `pnpm publish` — not `npm publish` — did the packing.
- Two changesets are pending (`font` minor, `layout` minor, `sdf` and `three-webgpu`
  patch), so the next release is `0.2.0` across the fixed group.

The decisive constraint is the interaction between two independent needs. `layout` and
`three` declare `workspace:^` dependencies, which must be rewritten to real semver or the
packages publish broken. And publication must authenticate without a long-lived token.
Verified against the installed pnpm 11.10.0 binary, `pnpm publish` satisfies both:

```
  releasing/commands/lib/publish/oidc/

  getIdToken()                              idToken.js
    env.NPM_ID_TOKEN            ──▶ use directly
    !GITHUB_ACTIONS             ──▶ undefined (skip OIDC)
    missing ACTIONS_ID_TOKEN_*  ──▶ throw IncorrectPermissionsError
    GET $ACTIONS_ID_TOKEN_REQUEST_URL?audience=npm:registry.npmjs.org
        │ .value
        ▼
  fetchAuthToken()                          authToken.js
    POST {registry}/-/npm/v1/oidc/token/exchange/package/{escapedName}
      Authorization: Bearer <idToken>
        │ .token
        ▼
  determineProvenance()                     provenance.js
        │
        ▼
  publishOptions.token       = authToken
  publishOptions.provenance ??= <determined>
        ▼
  libnpmpublish
```

This is automatic — there is no `--oidc` flag, which is why `pnpm publish --help` shows
nothing about it. It triggers whenever `GITHUB_ACTIONS` is set and a registry resolves,
and it is scoped per package name, which suits a four-package family.

`changeset publish` selects the publishing tool via `getPublishTool()`, which reads the
root `packageManager` field (`pnpm@11.10.0`) and spawns `pnpm publish`. So the existing
`pnpm release:publish` script already routes through the OIDC path. Nothing about the
publishing mechanism needs to change.

## Goals / Non-Goals

**Goals:**

- Release by merging the Changesets version pull request, with no manual dispatch and no
  local publish command.
- Authenticate with short-lived OIDC credentials; never introduce an `NPM_TOKEN`.
- Produce provenance attestation on every published version, and fail the release when
  that evidence is absent.
- Push the version commit and per-package git tags to the canonical repository.
- Run the packed release-candidate validation at release time, not only on pull requests.
- Leave the release documentation describing one flow rather than two contradictory ones.

**Non-Goals:**

- Changing any package's source, public API, or observable behavior.
- Changing the versioning model. The fixed four-package group, `main` base branch, and
  default changelogs all stay.
- Re-publishing or retro-attesting `0.1.x`.
- Publishing prereleases, snapshots, or dist-tags other than `latest`.
- Adopting pnpm's install-side trust-checking policy for consumers; that is a separate
  concern from how this project publishes.

## Decisions

### Publish with `pnpm publish` via `changeset publish`

Keep the existing `release:publish` script unchanged.

*Why:* it is the only option that both rewrites `workspace:^` and performs the OIDC
exchange.

| | rewrites `workspace:^` | OIDC trusted publishing |
|---|---|---|
| `pnpm publish` (11.10.0) | yes | yes |
| `npm publish` | no | yes |
| `pnpm pack` → `npm publish <tgz>` | yes | yes |

*Alternatives considered:* `npm publish` alone is disqualified — it would ship
`workspace:^` to the registry. The `pnpm pack` → `npm publish <tarball>` hybrid works,
but it would mean hand-rolling the two things `changeset publish` already does correctly:
skipping versions already on the registry, and creating git tags. It also puts the
dependency-order requirement on our own loop. Rejected as strictly more moving parts for
no gain now that pnpm does the exchange natively.

### One workflow, triggered by the version-PR merge

Give `changesets/action` the `publish` input alongside `version`, and retire the separate
manual-dispatch workflow.

*Why:* the action already distinguishes the two cases — changesets present means
maintain the version PR; none present means publish. That makes "merge the version PR"
the release trigger and the authorization boundary, which is the canonical Changesets
flow. It also puts tag pushing and GitHub Release creation on the path that the action
handles for us.

*Alternatives considered:* keeping `workflow_dispatch` would preserve a literal button,
but the version PR is already a human review gate for versions and changelogs, so the
button is a second gate over the same decision. A protected GitHub environment with
required reviewers was also considered and is noted under Open Questions as a later
hardening step rather than part of this change.

### The release workflow keeps the filename `publish.yml`

The single workflow lives at `.github/workflows/publish.yml`. `release-pr.yml` was renamed
into it rather than the reverse.

*Why:* npm matches a trusted publisher's workflow-filename field against the OIDC token's
`job_workflow_ref` claim, and all four packages were already configured against
`publish.yml`. Keeping that name means zero npm edits, and therefore no opportunity to
mistype the one field whose mismatch fails silently instead of loudly. The name is a
slight misnomer for a workflow that also maintains the version PR, which the file's header
comment explains.

*Consequence:* renaming this file is now a breaking change to the release path. It must be
done together with editing the trusted publisher on all four packages, never alone. Both
the workflow header and `docs/RELEASING.md` say so.

*Alternatives considered:* pointing npm at `release-pr.yml` (four manual edits to the
silent-failure field), or renaming to `release.yml` for accuracy (a repo rename *and* four
npm edits — most moving parts, most chances to mismatch).

### Dependency ordering is delegated, not implemented

`changeset publish` publishes in topological order, so `font` and `sdf` precede `layout`,
which precedes `three-webgpu`.

*Why:* the requirement that a dependent never resolves a nonexistent version is real, but
it is already satisfied. Writing our own ordering would duplicate it. This decision is
recorded because a future move away from `changeset publish` would silently reintroduce
the hazard.

### Treat a `Skipped OIDC` warning as a release failure

Verify trust evidence on the registry after publishing, and fail the run when a version
lacks provenance.

*Why:* this is the sharpest hazard in the whole change. In
`fetchTokenAndProvenanceByOidc`, pnpm catches both `IdTokenError` and `AuthTokenError`,
emits `globalWarn("Skipped OIDC: ...")`, returns `undefined`, and continues with whatever
credential `.npmrc` supplies. The graceful degradation is good for local publishing but
dangerous in CI: a misconfigured trusted publisher surfaces as a warning buried in logs,
and the outcome is either a confusing auth failure or — if any other credential is
reachable — a *successful but untrusted* publish. A green checkmark is therefore not
evidence of a trusted release. The registry is.

Verification mirrors pnpm's own `getTrustEvidence()`, which ranks
`stagedPublish` > `trustedPublisher` > `provenance` and requires
`_npmUser.trustedPublisher` **and** `dist.attestations.provenance` for the
`trustedPublisher` tier.

### Grant `contents: write`; drop the global npm install

The publishing job needs `contents: write` to push the version commit and tags, and
`id-token: write` to request the identity token. The `npm install --global npm@^11.5.1`
step is removed.

*Why:* the current `publish.yml` has `contents: read`, so it could not push tags even if
Changesets created them. The npm global install existed to make `npm` OIDC-capable, but
`npm` never performs the publish — `pnpm` does. It is misleading rather than harmful, and
it invites someone to "fix" auth by reaching for a token.

`NPM_CONFIG_PROVENANCE=true` is retained but is now belt-and-braces: pnpm's
`publishOptions.provenance ??= ...` means an explicit setting wins over its own detection.

## Risks / Trade-offs

- **npm trusted publishers may not actually be configured.** The registry shows no
  trusted-publisher evidence on any `0.1.1` version, and the documented bootstrap used
  `NPM_CONFIG_PROVENANCE=false`, so the configuration step may never have happened. →
  Treat it as an explicit prerequisite task with a `--dry-run` confirmation before the
  first real release, not as a formality. This is the single most likely cause of a failed
  first run.
- **A misconfiguration can publish successfully but untrusted.** → The post-publish trust
  assertion above; this is exactly what it exists to catch.
- **Merging the version PR becomes irreversible.** A published npm version cannot be
  replaced, so a mis-merge is a real release. → The version PR shows the exact versions
  and changelogs before merge; the release-candidate gate runs before any registry
  contact; and a bad release is handled forward with a new version, never by reuse.
- **Losing the manual button removes a deliberate pause.** → Accepted: the version PR is
  the pause. A protected environment can restore an explicit approval later without
  changing this design.
- **A pnpm upgrade could regress the OIDC path.** Trusted publishing is verified present
  in 11.10.0; the release that introduced it is not established, so the lower bound is
  unknown. → `packageManager: pnpm@11.10.0` plus `pnpm/action-setup` pins CI to the exact
  verified version. Note the coupling so a future bump is treated as touching the release
  path.
- **`release:candidate` runs twice for a released commit** — once in CI, once in the
  release run. → Accepted; a few minutes of duplicated validation is the correct trade
  for a gate that actually guards the registry.
- **First release under the new flow is also the first attested one.** → This is
  favorable, not risky: pnpm's install-side trust check warns on *downgrade*, and `0.1.x`
  has no trust evidence at all, so adding attestation at `0.2.0` is a strict upgrade and
  cannot trip it.

## Migration Plan

1. Confirm or configure the npm trusted publisher for each of the four packages
   (`julia-script` / `text-rendering-toolkit` / `publish.yml` → the new workflow
   filename). Update the workflow-name field to match whatever file publishes.
2. Rename `release-pr.yml` to `publish.yml` (matching the existing trusted-publisher
   configuration) and add the `publish` input, `contents: write` + `id-token: write`, and
   the `release:candidate` gate. The old manual-dispatch `publish.yml` is replaced by it.
3. Dry-run the publish path before the first real release to confirm the token exchange
   succeeds and no `Skipped OIDC` warning appears.
4. Merge the pending version PR to release `0.2.0`.
5. Verify on the registry: coordinated version across all four, provenance attestations
   present, rewritten dependency ranges, tags pushed, and a clean-directory install.
6. Reconcile docs: delete root `RELEASING.md`, rewrite `docs/RELEASING.md`.

**Rollback:** the change is workflow and documentation only, so reverting the commit
restores the manual dispatch path. A published version cannot be rolled back — recovery
is always forward via a new coordinated version, with deprecation of a broken one where
warranted.

## Open Questions

- Which pnpm release first shipped the OIDC publish path? Not needed for this change
  because the version is pinned, but it bounds future upgrades.
- Should the publish job later run in a protected GitHub environment with required
  reviewers? Deliberately deferred; it composes with this design rather than altering it.
- Should GitHub Releases be created in addition to git tags? `changesets/action` can do
  this when it performs the publish, and the packages already carry CHANGELOGs. Low cost,
  but it is an added public surface worth choosing intentionally.
- After the first successful OIDC release, should npm publishing access be tightened to
  disallow token-based publishes outright? That would convert the "silent fallback"
  hazard from a detected failure into an impossible one.

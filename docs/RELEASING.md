# Releasing Text Rendering Toolkit

Releases are automated. Record changes with changesets, then merge the version pull
request — that merge is the authorization to publish, and no other event publishes.

To apply this same setup to another pnpm + Changesets monorepo, see
[porting-trusted-publishing.md](./porting-trusted-publishing.md).

```
  PR with a changeset merged to main
        │
        ▼
  Release workflow ── changesets exist? ──▶ open/update "Version Packages" PR
        │                                    (publishes nothing)
        │  you merge the version PR
        ▼
  Release workflow ── no changesets left ──▶ pnpm check
                                            pnpm release:candidate
                                            changeset publish  ──▶ npm
                                            push version commit + tags
                                            verify trust evidence
```

`.github/workflows/publish.yml` does both jobs. `.github/workflows/ci.yml` validates
pull requests and cannot publish.

Do not rename `publish.yml`. Each package's npm trusted publisher names that file
exactly, and a mismatch does not fail loudly — see the `Skipped OIDC` section below.

## Record a change

Add release notes as part of the same change, not as a follow-up:

```sh
pnpm changeset
```

The four public packages form one fixed Changesets group, so any one of them releases the
whole family on a single coordinated version. See `AGENTS.md` for when a changeset is
required and how to choose the bump.

## Release

1. Merge the pull requests you want in the release, each carrying its changeset.
2. The release workflow opens or updates a **Version Packages** pull request. Review the
   versions and the assembled changelogs — this is the human gate.
3. Merge it. The workflow then validates, publishes every package whose version is not
   already on the registry, pushes the version commit and one git tag per package, and
   verifies the result.

`changeset publish` publishes in dependency order, so `font` and `sdf` precede `layout`,
which precedes `three-webgpu`. A dependent never resolves a version that does not exist
yet.

A published version can never be replaced. If a release fails partway through, leave the
valid packages in place, deprecate a broken version if warranted, fix the cause, and
release the **next** coordinated version. Never reuse a version number.

## Why the publishing tool must stay pnpm

`changeset publish` resolves its publishing tool from the root `packageManager` field, so
it runs `pnpm publish`. That is load-bearing for two independent reasons, and pnpm is the
only option that satisfies both:

|                                   | rewrites `workspace:` | OIDC trusted publishing |
| --------------------------------- | --------------------- | ----------------------- |
| `pnpm publish`                    | yes                   | yes                     |
| `npm publish`                     | no                    | yes                     |
| `pnpm pack` → `npm publish <tgz>` | yes                   | yes                     |

- **Workspace ranges.** `layout` and `three` declare `workspace:^` dependencies. These
  must become real semver on the way to the registry or the packages install but cannot
  resolve. `pnpm publish` rewrites them; `npm publish` does not.
- **Authentication.** pnpm performs the npm OIDC token exchange itself — it requests a
  GitHub Actions identity token for the `npm:registry.npmjs.org` audience, exchanges it at
  `/-/npm/v1/oidc/token/exchange/package/<name>` for a short-lived package-scoped
  credential, and determines provenance. This is automatic whenever `GITHUB_ACTIONS` is
  set; there is no flag, which is why `pnpm publish --help` does not mention it.

There is **no `NPM_TOKEN`**. Never add one, never commit an `.npmrc`, and never introduce a
token-backed publish path. If publication fails with an authentication error, the cause is
the trusted-publisher configuration, not a missing secret.

Trusted publishing is verified present in pnpm 11.10.0, which `packageManager` pins and
`pnpm/action-setup` resolves. The release that introduced it is not established, so treat a
pnpm upgrade as a change to the release path.

## The `Skipped OIDC` failure mode

This is the sharpest hazard in the release path, and the reason the workflow verifies its
own output.

When the token exchange fails, pnpm does **not** fail the publish. It logs
`Skipped OIDC: <reason>`, returns no token, and continues with whatever credential is
otherwise reachable. That graceful degradation is right for a local publish and dangerous
in CI: depending on what else is in the environment, the outcome is either a confusing
authentication error or — worse — a **successful but untrusted** publish. A green
workflow is therefore not evidence of a trusted release.

Two independent guards close that gap, because neither covers the other's case.

**During the publish.** The workflow runs `pnpm release:publish:ci`, a thin wrapper
(`.github/scripts/publish-with-oidc-guard.mjs`) that watches the publish output for the
warning and fails the release if it appears — even when the publish itself exits `0`. The
warning only exists on that command's own output, so it cannot be caught from a later
step. The wrapper forwards stdout byte-for-byte, because `changesets/action` parses it to
build the `published` and `publishedPackages` outputs that drive the check below and the
GitHub releases.

**After the publish.** `.github/scripts/verify-release-trust.mjs` reads each published
version straight from the registry packument and fails the run unless every package has:

1. `_npmUser.trustedPublisher` — published through a trusted publisher;
2. `dist.attestations.provenance` — a provenance attestation;
3. the same coordinated version as the rest of the family;
4. no `workspace:` range that survived publication.

Conditions 1 and 2 together are what pnpm's own install-side trust check requires for its
`trustedPublisher` tier; provenance alone is a weaker tier. The script reads the packument
over HTTP rather than shelling out to `npm view`, because `npm view` renders `_npmUser` as
a display string and drops the nested `trustedPublisher` object.

Its offline checks run as part of `pnpm check`:

```sh
pnpm test:scripts
```

## Configure trusted publishing

Each package needs a GitHub Actions trusted publisher in its npm settings:

- GitHub owner: `julia-script`
- Repository: `text-rendering-toolkit`
- Workflow filename: `publish.yml`
- Allowed action: `npm publish`
- Environment: leave blank unless a matching protected GitHub environment is added later

The workflow filename must match exactly. A mismatch produces the `Skipped OIDC` path
above rather than a clear error.

Once OIDC succeeds for all four packages, set npm publishing access to require 2FA and
disallow traditional tokens, and revoke any bootstrap token. That converts the silent
fallback from a detected failure into an impossible one.

## Verify a publication

The workflow does this automatically, but to check by hand:

```sh
npm view @text-rendering-toolkit/font version license repository
npm view @text-rendering-toolkit/layout version license repository
npm view @text-rendering-toolkit/sdf version license repository
npm view @text-rendering-toolkit/three-webgpu version license repository
npm audit signatures
```

Confirm all four versions match, the npm pages show public access and provenance, and
installing the family from the registry in a clean directory succeeds.

## Appendix: how `0.1.x` was published

Historical background — this is **not** the current process.

npm requires a package to exist in the registry before a trusted publisher can be
configured for it, so the first versions could not themselves be trusted-published. The
`0.1.0` and `0.1.1` releases were therefore bootstrapped by hand: an interactive
`npm login`, four serial `pnpm --dir packages/* publish` commands in dependency order, and
`NPM_CONFIG_PROVENANCE=false`. Their git tags were created against a hand-written release
commit.

Those versions consequently carry no trusted-publisher marker and no provenance
attestation. Because pnpm's install-side check warns on trust *downgrade* and `0.1.x` has
no trust evidence at all, the first automated release is a strict upgrade and cannot trip
it.

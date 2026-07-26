## Why

The `0.1.x` family was published by hand: an interactive `npm login`, four serial
`pnpm publish` commands, `NPM_CONFIG_PROVENANCE=false`, and a hand-written release
commit with hand-made tags. That bootstrap was correct for creating packages that did
not yet exist in the registry — npm requires a package to exist before a trusted
publisher can be configured for it — but it is not a repeatable release process.

Two pending changesets now put the family at `0.2.0`, so the next release is the first
one that can run entirely from CI. Meanwhile `pnpm publish` gained native npm trusted
publishing: it performs the GitHub Actions OIDC token exchange itself, per package, and
determines provenance without a long-lived `NPM_TOKEN`. The repository already has the
Changesets version-PR workflow and an OIDC-permissioned publish workflow, but the two
were never connected, and neither can currently publish without a credential that the
project deliberately does not have.

## What Changes

- Publish automatically when the Changesets version pull request merges, replacing the
  manual `workflow_dispatch` gate. `changesets/action` gains a `publish` input so one
  workflow both maintains the version PR and releases when no changesets remain.
- Grant the publishing job the permissions it needs to complete a release: `contents:
  write` so Changesets can push the version commit and its git tags, and `id-token:
  write` so `pnpm publish` can request an Actions ID token.
- Keep `pnpm publish` as the publishing tool. `changeset publish` resolves it from the
  root `packageManager` field, and it is the only option that both rewrites
  `workspace:^` dependency ranges into registry-safe semver and performs the npm OIDC
  exchange. No packing-and-republishing workaround is needed.
- Move the packed release-candidate validation into the publish path so the gate runs at
  release time rather than only on pull requests.
- Configure and verify npm trusted publishers for all four packages. The published
  `0.1.1` versions carry no trusted-publisher or provenance evidence, so this is
  outstanding setup, not a formality.
- Assert that a release actually produced trust evidence, rather than trusting a green
  workflow. `pnpm publish` degrades to a `Skipped OIDC` warning and falls back to
  `.npmrc` credentials when the exchange fails, so a misconfiguration otherwise
  surfaces only as an authentication error or, worse, a silently untrusted publish.
- Remove the `npm install --global npm@^11.5.1` step from the publish workflow. It
  existed to make `npm` OIDC-capable, but `npm` never performs the publish.
- Reconcile the release documentation: delete the stale root `RELEASING.md`, which still
  describes the pre-launch gates and a manual seven-step sequence, and rewrite
  `docs/RELEASING.md` around the automated flow while retaining the bootstrap history as
  background.

## Capabilities

### New Capabilities

None. This change revises how an existing capability releases; it introduces no new
behavioral surface.

### Modified Capabilities

- `public-release-workflow`: The requirement to keep npm publication owner-controlled
  currently forbids publishing as an effect of applying a change, and the CI requirement
  describes a release workflow that only maintains a version pull request. Both are
  replaced: merging the version pull request becomes the authorization boundary, the
  release workflow publishes, and new requirements cover trusted-publisher
  authentication, provenance, git tag propagation, and verifying trust evidence after a
  release.

## Impact

- `.github/workflows/publish.yml` — the single release workflow: gains the `publish`
  input, elevated permissions, and the release-candidate gate. Retains this filename
  because each package's npm trusted publisher already names it.
- `.github/workflows/release-pr.yml` — renamed to `publish.yml`; its version-PR
  responsibilities are unchanged.
- `.github/workflows/ci.yml` — unchanged; it continues to validate pull requests.
- `RELEASING.md` — deleted.
- `docs/RELEASING.md` — rewritten.
- `openspec/specs/public-release-workflow/spec.md` — requirements revised via delta.
- npm registry settings for the four `@text-rendering-toolkit` packages — a
  trusted publisher must be configured for each, outside the repository.
- No package source, public API, or consumer-visible behavior changes. The two pending
  changesets and their `0.2.0` release notes are unaffected.
- First release under this flow is expected to be a strict trust upgrade: `0.1.x` has no
  trust evidence, so adding trusted-publisher provenance at `0.2.0` cannot trip pnpm's
  install-side trust-downgrade check.

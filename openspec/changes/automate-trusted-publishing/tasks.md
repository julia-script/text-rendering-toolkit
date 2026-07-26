## 1. Confirm npm-side prerequisites

- [x] 1.1 Verified all four packages already have a GitHub Actions trusted publisher: `julia-script/text-rendering-toolkit`, workflow `publish.yml`, permission `npm publish`. It was configured but never used for the `0.1.x` bootstrap, which is why those versions carry no trust evidence.
- [x] 1.2 Confirm the trusted publisher on every package reads owner `julia-script`, repository `text-rendering-toolkit`, workflow filename `publish.yml`, allowed action `npm publish`, environment blank. Already configured; the workflow was renamed to match rather than editing four npm forms.
- [x] 1.3 Publishing access is set to "Require two-factor authentication or a granular access token with bypass 2fa enabled" on all four. npm documents every publishing-access option as compatible with OIDC trusted publishers, so CI faces no proof-of-presence prompt. Tighten to "disallow tokens" after the first successful OIDC release.
- [x] 1.4 Confirm no `NPM_TOKEN`, `.npmrc`, or equivalent publish credential exists as a repository or organization secret, and remove any leftover bootstrap token.

## 2. Rewrite the release workflow

- [x] 2.1 Decide and record the single publishing workflow filename: `publish.yml`, matching the existing trusted-publisher configuration.
- [x] 2.2 Add the `publish` input to the `changesets/action` step in `.github/workflows/publish.yml` alongside the existing `version` input.
- [x] 2.3 Raise the job permissions to `contents: write` (version commit and git tags), `pull-requests: write` (version PR), and `id-token: write` (OIDC identity token).
- [x] 2.4 Run `pnpm check` and `pnpm release:candidate` before the `changesets/action` step so no registry contact happens from an unvalidated tree.
- [x] 2.5 Set `NPM_CONFIG_PROVENANCE: "true"` on the publish step's environment.
- [x] 2.6 Retire the separate manual-dispatch workflow, including its unnecessary `npm install --global npm@^11.5.1` step. Implemented by renaming `release-pr.yml` over it, so the single remaining workflow keeps the filename `publish.yml` that the npm trusted publishers already name.
- [x] 2.7 Confirm `.github/workflows/ci.yml` still validates pull requests and remains incapable of publishing.
- [x] 2.8 Confirm `packageManager` remains pinned to `pnpm@11.10.0` and that `pnpm/action-setup` resolves that exact version, since the OIDC publish path is verified only there.

## 3. Add release verification

- [x] 3.1 Add a post-publish step that reads each published version from the registry and asserts both `_npmUser.trustedPublisher` and `dist.attestations.provenance` are present, failing the run when either is missing.
- [x] 3.2 Make the workflow fail when a publish step emits a `Skipped OIDC` warning, so a silent fallback to other credentials cannot be reported as a successful release.
- [x] 3.3 Assert every published package reports the same coordinated version.
- [x] 3.4 Assert each published dependent declares registry-resolvable semver ranges rather than `workspace:` ranges.

## 4. Verify what can be verified before publishing

The OIDC token exchange cannot be rehearsed. `getIdToken()` returns `undefined` unless
`GITHUB_ACTIONS` is set, and the exchange needs an Actions-issued identity token, so no
local `--dry-run` exercises it. The first real publish is the first true test — which is
why the two guards exist. These tasks cover everything that *can* be checked first.

- [ ] 4.1 Push the change to a branch and confirm CI passes, so the release run's `pnpm check` and `pnpm release:candidate` gates are known-good before they guard a publish.
- [ ] 4.2 Confirm the workflow file parses and its steps resolve as expected on GitHub (no invalid `if:` expressions, and `changesets/action` accepts both the `version` and `publish` inputs).
- [x] 4.3 Confirm `pnpm release:publish:ci` forwards publish stdout unchanged, since `changesets/action` parses it to produce the `published` and `publishedPackages` outputs that drive the trust verification and the tags. Covered by the guard's own tests in `pnpm check`.
- [ ] 4.4 Re-read the `Skipped OIDC` failure path before merging: on a mismatch the wrapper fails the release, and with no `NPM_TOKEN` anywhere the publish cannot silently fall back to a token.

## 5. Release 0.2.0 through the new flow

- [ ] 5.1 Confirm the Changesets version PR contains the expected `0.2.0` bump for all four packages and the release notes from both pending changesets.
- [ ] 5.2 Merge the version PR and confirm the release workflow publishes rather than reopening a version PR.
- [ ] 5.3 Confirm publication happened in dependency order, with `font` and `sdf` before `layout` and `layout` before `three-webgpu`.
- [ ] 5.4 Confirm the version commit and one git tag per released package were pushed to the canonical repository.
- [ ] 5.5 Verify on the registry that all four packages expose `0.2.0`, public access, canonical repository metadata, and provenance attestations.
- [ ] 5.6 Install the four packages from the registry in a clean directory outside the repository and confirm the public consumer type-check and runtime handoffs pass.
- [ ] 5.7 Confirm no trust-downgrade warning occurs on install, since `0.1.x` carried no trust evidence and `0.2.0` adds attestation.

## 6. Reconcile the documentation

- [x] 6.1 Delete the stale root `RELEASING.md`, whose pre-launch publication gates and manual seven-step sequence no longer describe the process.
- [x] 6.2 Rewrite `docs/RELEASING.md` around the automated flow: add a changeset, merge the version PR, publication happens automatically with OIDC and provenance.
- [x] 6.3 Document that `pnpm publish` performs the OIDC exchange itself, that it also rewrites `workspace:` ranges, and that this is why the publishing tool must stay pnpm.
- [x] 6.4 Document the `Skipped OIDC` failure mode and how the post-publish trust assertion catches it.
- [x] 6.5 Retain the `0.1.x` manual bootstrap as clearly-labelled historical background, explaining that npm required the packages to exist before a trusted publisher could be configured.
- [x] 6.6 Replace the manual-dispatch and token-recovery instructions with the note that no long-lived npm token is used.
- [x] 6.7 Update the release-policy line in `ROADMAP.md` if it still implies manual publication.

## 7. Validate and close out

- [x] 7.1 Run `pnpm check` and make it pass.
- [x] 7.2 Run `openspec validate --changes automate-trusted-publishing --strict` and resolve any findings.
- [x] 7.3 Confirm no package source, public API, or consumer-visible behavior changed in this change.
- [ ] 7.4 Sync the `public-release-workflow` delta into `openspec/specs/` and archive the change.

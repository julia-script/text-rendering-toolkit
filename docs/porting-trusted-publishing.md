# Porting trusted publishing to another pnpm + Changesets monorepo

A prompt-and-checklist guide for applying the setup from this repository to a similar one.
Hand the prompt in [§2](#2-the-prompt) to an AI agent working in the target repo, then use
[§4](#4-review-checklist) to check its work.

Read [§1](#1-what-this-actually-changes) yourself first — two of the decisions there are
easy to get wrong in a way that fails silently.

---

## 1. What this actually changes

**Before:** a `version` workflow opens a Changesets version PR; publishing is manual or
uses a long-lived `NPM_TOKEN`.

**After:** merging the version PR publishes, authenticated by a short-lived GitHub Actions
OIDC credential. No token anywhere.

```
  PR with a changeset merged
        │
        ▼
  Release workflow ── changesets exist? ──▶ open/update version PR (publishes nothing)
        │  merge the version PR
        ▼
  Release workflow ── none left ──▶ checks ──▶ publish ──▶ push tags ──▶ verify trust
```

### The two things that bite

**1. `pnpm publish` must stay the publishing tool.** `changeset publish` picks its tool
from the root `packageManager` field. That matters when any package depends on a sibling
via `workspace:`:

|                                   | rewrites `workspace:` | OIDC trusted publishing |
| --------------------------------- | --------------------- | ----------------------- |
| `pnpm publish`                    | yes                   | yes                     |
| `npm publish`                     | **no**                | yes                     |

If `npm publish` runs instead, `workspace:^` reaches the registry and the package installs
but cannot resolve. Verified present in pnpm 11.10.0; the release that introduced OIDC
support is not established, so pin `packageManager` and treat a pnpm bump as touching the
release path.

**2. A failed OIDC exchange does not fail the publish.** pnpm logs `Skipped OIDC: <reason>`
and continues with any other reachable credential. So a green workflow is *not* evidence of
a trusted release. Two consequences:

- If a stale `NPM_TOKEN` secret exists, a misconfiguration silently publishes **untrusted**.
  Delete the secret — its absence is what turns a silent fallback into a clean failure.
- Verify trust evidence on the registry after publishing, not just the exit code.

**3. The workflow filename is load-bearing.** npm matches the trusted publisher's
workflow-filename field against the OIDC token's `job_workflow_ref` claim. A mismatch
produces the silent path above, not a clear error. Decide the filename *before* configuring
npm, and prefer renaming the workflow to match an existing npm config over editing one npm
form per package.

---

## 2. The prompt

Copy this verbatim. Replace nothing — it is written to make the agent inspect rather than
assume.

````text
Migrate this repo's release process to publish from GitHub Actions using npm trusted
publishing (OIDC), with no long-lived NPM_TOKEN. It is a pnpm monorepo using Changesets.

Work in this order and VERIFY each claim against the actual repo or registry rather than
assuming. Do not guess at tool behavior — read the installed code or run it.

## Phase 1 — Establish the facts before changing anything

Report findings before editing:

1. Which packages are published vs private? Read every `packages/*/package.json`.
2. Do any published packages depend on siblings via `workspace:`? List them.
3. Is `packageManager` pinned in the root `package.json`? To what?
4. Does the installed pnpm support OIDC trusted publishing? Do not trust my word or
   your training data — grep the actual binary:
     grep -rl "npm/v1/oidc" "$(dirname "$(readlink -f "$(command -v pnpm)")")/.."
   Then read the token-exchange code you find and report how it triggers and what it
   does when the exchange fails.
5. Which existing workflows publish, and what `permissions` do they declare?
6. Is `.changeset/config.json` using a `fixed` or `linked` group, or neither?
7. Are the packages already published to npm? For each, read the registry PACKUMENT
   (https://registry.npmjs.org/<url-encoded-name>) — NOT `npm view` — and report whether
   `_npmUser.trustedPublisher` and `dist.attestations.provenance` exist on the latest
   version. `npm view` renders `_npmUser` as a display string and hides the field.
8. Do any GitHub secrets or variables exist? `gh secret list` and `gh variable list`.
9. Is `can_approve_pull_request_reviews` enabled?
   gh api repos/OWNER/REPO/actions/permissions/workflow
   If false, Changesets cannot create the version PR.

## Phase 2 — Decide the workflow filename

If a trusted publisher is ALREADY configured on npm for any package, read the workflow
filename it names and keep it — rename the local workflow to match instead of editing npm.
npm matches that field against the OIDC token's job_workflow_ref claim, and a mismatch
fails silently. Tell me the filename you chose and why.

## Phase 3 — Single release workflow

Consolidate to ONE workflow that both maintains the version PR and publishes:

- trigger: push to the default branch
- permissions: `contents: write`, `pull-requests: write`, `id-token: write`
- steps: checkout → pnpm/action-setup → setup-node (with `registry-url`) → install →
  the repo's own full check gate → the repo's packed-artifact validation if it has one →
  `changesets/action` with BOTH `version:` and `publish:` inputs → post-publish trust check
- `NPM_CONFIG_PROVENANCE: "true"` on the publish step
- delete any manual-dispatch publish workflow and any step that installs npm globally to
  get OIDC support — npm is not the publishing tool here, pnpm is
- add a comment stating the filename must match the npm trusted-publisher config and that
  renaming it breaks releases silently

## Phase 4 — Two independent guards

pnpm downgrades a failed OIDC exchange to a `Skipped OIDC` warning and publishes anyway.
Both guards are needed; neither covers the other's case.

(a) DURING publish. Wrap the publish in a script that watches its output for
`Skipped OIDC` and fails the release if seen. CRITICAL: the wrapper must forward the
publish command's stdout BYTE-FOR-BYTE, because `changesets/action` parses it to produce
its `published` and `publishedPackages` outputs. Swallowing stdout silently disables the
trust check and the tags. Write a test asserting stdout is forwarded unchanged.

(b) AFTER publish. A script that reads each published version from the registry PACKUMENT
over HTTP (not `npm view` — see Phase 1.7) and fails unless every package has:
  1. `_npmUser.trustedPublisher`
  2. `dist.attestations.provenance`
  3. no `workspace:` range surviving in published `dependencies`
  4. one coordinated version across the family — ONLY if Phase 1.6 found a `fixed`/`linked`
     group. If versions are independent, skip this check; it would produce false failures.
Gate it on the action's `published == 'true'` output. Retry briefly: a fresh version can
lag in the packument.

Both scripts must be covered by tests that run in the repo's normal check command. Add
their directory to the linter's include list if it uses an allowlist, and declare any new
env vars if the repo uses Turborepo (`globalPassThroughEnv`).

## Phase 5 — Verify what is verifiable, and be honest about what is not

The OIDC exchange CANNOT be rehearsed locally: it needs an Actions-issued identity token,
so `--dry-run` does not exercise it. Do not claim a local run proves the exchange works.
Verify instead: the check gate passes, the workflow parses on GitHub, the wrapper forwards
stdout, and no NPM_TOKEN exists. State plainly that the first real publish is the first
true test of OIDC.

## Phase 6 — Documentation

Update the release docs to the new flow and DELETE any stale release doc that contradicts
it. Document: why the publishing tool must stay pnpm, the `Skipped OIDC` failure mode and
how both guards catch it, the exact npm trusted-publisher fields, and that the workflow
filename must not be renamed alone.

## Rules

- Make the repo's own check command pass. Use its formatter rather than hand-editing style.
- Do not add a changeset unless the repo's conventions require one for tooling changes.
- Do not configure npm settings — tell me exactly what to click.
- Do not merge anything. Push a branch and stop.
- If a claim you made turns out wrong when you test it, say so and correct it.
````

---

## 3. What you must do by hand

npm's trusted-publisher config is website-only. For **each** published package, at
`https://www.npmjs.com/package/<name>/access`:

| Field | Value |
| ----- | ----- |
| Organization or user | your GitHub owner |
| Repository | the repo name |
| Workflow filename | the basename chosen in Phase 2, e.g. `publish.yml` |
| Environment | blank |

Then check **Publishing access**:

- Leave it permissive enough for automation until the first OIDC release succeeds.
- *After* that, switch to **"Require two-factor authentication and disallow tokens"**. This
  is what makes the silent-fallback hazard impossible rather than merely detected.

### Chicken-and-egg for brand-new packages

npm requires a package to **exist** before a trusted publisher can be configured for it. A
never-published package therefore needs one manual bootstrap publish (interactive login,
`NPM_CONFIG_PROVENANCE=false`, in dependency order), *then* the trusted publisher, and its
next release is the first attested one. Already-published packages skip this entirely.

---

## 4. Review checklist

Verify these yourself — most are exactly where an agent will sound confident and be wrong.

- [ ] `packageManager` pins pnpm, and `changeset publish` therefore resolves `pnpm publish`
- [ ] No `NPM_TOKEN` in repo, org, or Dependabot secrets
- [ ] Exactly one workflow can publish; any manual-dispatch publisher is gone
- [ ] That workflow declares all three permissions including `id-token: write`
- [ ] Its filename matches the npm trusted-publisher field **exactly**
- [ ] `can_approve_pull_request_reviews` is true
- [ ] The publish wrapper forwards stdout unchanged — **there is a test proving it**
- [ ] The trust verifier reads the packument over HTTP, not `npm view`
- [ ] The version-alignment check exists only if there is a `fixed`/`linked` group
- [ ] New scripts are linted and their tests run in the normal check command
- [ ] No stale release doc contradicts the new one

### After the first release, confirm on the registry — not in the logs

```sh
npm audit signatures   # in a clean dir after installing the family
```

Expect "N packages have verified attestations". Then check the published dependency ranges
resolved to real semver, tags were pushed, and a clean-directory install works.

The workflow log should contain a line like:

```
No NPM_TOKEN found, but OIDC is available - using npm trusted publishing
```

If instead you see `Skipped OIDC`, the release was not trusted. Do not retry the same
version — a published version cannot be replaced. Fix the configuration and release the
next one.

---

## 5. Reference implementation

In this repo:

- `.github/workflows/publish.yml` — the single release workflow
- `.github/scripts/publish-with-oidc-guard.mjs` — during-publish guard (+ its test)
- `.github/scripts/verify-release-trust.mjs` — post-publish verifier (+ its test)
- `docs/RELEASING.md` — the resulting release documentation
- `openspec/changes/archive/2026-07-26-automate-trusted-publishing/` — proposal, design
  with alternatives considered, and the full task list

Both production scripts are repo-agnostic and can be copied as-is; only their **tests**
reference this project's package names. The one behavioral assumption to revisit is the
version-alignment check, which presumes a `fixed` Changesets group.

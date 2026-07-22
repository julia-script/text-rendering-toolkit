# Release process

The project can produce and validate a complete local package-family candidate, but it is not yet approved for npm publication. Technical validation and publication authorization are intentionally separate.

## Validate a local candidate

Run from the repository root:

```sh
pnpm release:candidate
```

The command builds the workspace, creates all four tarballs, audits their packed manifests and contents, and installs them in a temporary consumer outside the repository. That consumer type-checks and executes the public font, multilingual preparation/layout, CPU SDF, and Three.js handoffs without a GPU or workspace package links.

Generated evidence is local and ignored by Git:

- `.release-candidate/report.json` — source/environment identity, technical checks, archive hashes and sizes, and publication gates;
- `.release-candidate/packages/*.tgz` — the four exact archives that were tested.

A successful command means `technicalStatus` is `passed`. It does not mean `publicationStatus` is ready, and it does not publish, change manifests, create tags, or contact npm for ownership checks.

## Publication gates

Resolve every blocked entry in `report.json` before a public release:

1. Confirm the project name, package names, and ownership of the npm scope.
2. Select the license and copyright notice for this project's original code. Keep every existing third-party notice and bundled license.
3. Choose the initial public version and confirm that all four packages use it.
4. Add canonical repository, homepage, issue, license, and package-description metadata.
5. Confirm npm organization membership, package access, authentication, and whether two-factor approval is required.
6. Select and configure the npm provenance policy.

Third-party MIT licenses permit their covered code; they do not choose the license for this project.

## Authorized publication sequence

Only after the owner resolves the gates above:

1. Add the selected project license and complete the root and package metadata.
2. Set one coordinated non-placeholder version and remove each package's `private` guard in the release commit.
3. Run `pnpm check` and `pnpm release:candidate`; require a passing technical report and review all four hashes and inventories.
4. Run an npm publication dry run for each generated archive and inspect the resulting names, versions, access, dependencies, files, and notices.
5. Publish in dependency order: font and SDF first, layout after font, then Three.js after layout and SDF. Use the owner-approved access and provenance settings.
6. In a fresh directory, install the four packages from npm rather than the local archives and repeat the public consumer type/runtime check.
7. Record and push the release commit and tag according to the selected provenance workflow, then verify the npm package pages and provenance statements.

If publication fails partway through, do not reuse a published version. Leave valid packages in place, deprecate a broken version when appropriate, fix the issue, choose the next coordinated version, and rerun the full candidate check.

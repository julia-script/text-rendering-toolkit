# Releasing Text Rendering Toolkit

The repository separates version preparation from npm publication:

- `.github/workflows/release-pr.yml` uses Changesets to maintain a version pull request on `main`.
  It never publishes.
- `.github/workflows/publish.yml` runs only by manual dispatch, repeats the complete packed release
  validation, and then runs `pnpm release:publish`.
- CI and ordinary pushes never publish packages.

## Record and version changes

Add release notes with:

```sh
pnpm changeset
```

The four public packages form one fixed Changesets group, so one package change keeps the family on
the same version. Merge the Changesets version pull request only after CI passes.

## Recover npm access

The npm CLI login used during development may expire. Recover it locally rather than committing a
credential:

```sh
npm install --global npm@^11.15.0
npm login
npm whoami
```

Never commit `.npmrc`, an npm token, or a token-backed workflow. The steady-state publish workflow
uses GitHub Actions OIDC trusted publishing and needs no `NPM_TOKEN`.

## Bootstrap the first public versions

npm trusted-publisher configuration requires each package to exist in the registry first. An owner
must therefore authorize one bootstrap publication with an interactive npm login or a short-lived
granular token:

```sh
pnpm install --frozen-lockfile
pnpm release:candidate
NPM_CONFIG_PROVENANCE=false pnpm --dir packages/font publish --access public --publish-branch main
NPM_CONFIG_PROVENANCE=false pnpm --dir packages/sdf publish --access public --publish-branch main
NPM_CONFIG_PROVENANCE=false pnpm --dir packages/layout publish --access public --publish-branch main
NPM_CONFIG_PROVENANCE=false pnpm --dir packages/three publish --access public --publish-branch main
```

The first publication is deliberately serial because npm may require an
interactive proof-of-presence approval. Use pnpm rather than npm directly so
`workspace:` dependencies are converted to registry-safe semver ranges. The
dependency-safe publication order is:

1. `@text-rendering-toolkit/font`
2. `@text-rendering-toolkit/sdf`
3. `@text-rendering-toolkit/layout`
4. `@text-rendering-toolkit/three-webgpu`

All four package manifests request public access. Do not run the bootstrap command until the owner
has explicitly authorized the irreversible npm publication.

## Configure trusted publishing

After the first versions exist, configure a GitHub Actions trusted publisher in the npm settings
for each of the four packages:

- GitHub owner: `julia-script`
- Repository: `text-rendering-toolkit`
- Workflow filename: `publish.yml`
- Allowed action: `npm publish`
- Environment: leave blank unless a matching protected GitHub environment is added later

The manual workflow runs on a GitHub-hosted Node 24 runner, grants `id-token: write`, installs an npm
CLI that supports trusted publishing, and sets provenance for the Changesets publishing command.
Trusted publishing produces npm provenance without a long-lived write token.

Once OIDC succeeds for all four packages, set npm publishing access to require 2FA and disallow
traditional tokens, then revoke any bootstrap token.

## Verify a publication

Check each version and its canonical metadata:

```sh
npm view @text-rendering-toolkit/font version license repository
npm view @text-rendering-toolkit/layout version license repository
npm view @text-rendering-toolkit/sdf version license repository
npm view @text-rendering-toolkit/three-webgpu version license repository
npm audit signatures
```

Confirm that all four versions match, the npm pages show public access and provenance, installation
from the registry succeeds in a clean directory, and the GitHub workflow completed from
`julia-script/text-rendering-toolkit`.

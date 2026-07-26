// Verifies that a completed release actually carries trusted-publisher evidence.
//
// `pnpm publish` performs the npm OIDC token exchange itself, but it degrades
// gracefully: when the exchange fails it emits a `Skipped OIDC` warning, returns
// no token, and continues with whatever credential is otherwise reachable. That
// is correct for a local publish and dangerous in CI, because the publish can
// succeed while producing an untrusted version. A green workflow is therefore not
// evidence of a trusted release — the registry is.
//
// Reads the `publishedPackages` output of changesets/action from the environment
// and asserts, for each published version:
//
//   1. `_npmUser.trustedPublisher`      — published through a trusted publisher
//   2. `dist.attestations.provenance`   — provenance attestation recorded
//   3. one coordinated version across the whole family
//   4. no `workspace:` range survived into a published manifest
//
// Conditions 1 and 2 together are what pnpm's own install-side `getTrustEvidence()`
// requires for its `trustedPublisher` tier; provenance alone is a weaker tier.
//
// This reads the registry packument over HTTP rather than shelling out to
// `npm view`, because `npm view` renders `_npmUser` as a display string
// ("GitHub Actions <npm-oidc-no-reply@github.com>") and drops the nested
// `trustedPublisher` object that this check depends on.

const REGISTRY = process.env.NPM_REGISTRY ?? 'https://registry.npmjs.org'

/** @returns {Array<{name: string, version: string}>} */
function readPublishedPackages() {
  const raw = process.env.PUBLISHED_PACKAGES
  if (!raw || raw.trim() === '') {
    throw new Error(
      'PUBLISHED_PACKAGES is empty. This script must run only when changesets/action reports published == true.',
    )
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (cause) {
    throw new Error(`PUBLISHED_PACKAGES is not valid JSON: ${raw}`, { cause })
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`PUBLISHED_PACKAGES did not contain a non-empty array: ${raw}`)
  }

  for (const entry of parsed) {
    if (typeof entry?.name !== 'string' || typeof entry?.version !== 'string') {
      throw new Error(
        `PUBLISHED_PACKAGES entry is missing a name or version: ${JSON.stringify(entry)}`,
      )
    }
  }

  return parsed
}

/**
 * Reads one published version's manifest from the registry packument. A freshly
 * published version can lag briefly behind the packument, so this retries.
 */
export async function fetchRegistryManifest(
  name,
  version,
  { fetchImpl = fetch, retries = 5 } = {},
) {
  const url = new URL(encodeURIComponent(name).replace(/%40/, '@'), `${REGISTRY}/`).href

  for (let attempt = 0; ; attempt++) {
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`Registry returned ${response.status} for ${name} (${url})`)
    }

    const packument = await response.json()
    const manifest = packument?.versions?.[version]
    if (manifest) return manifest

    if (attempt >= retries) {
      throw new Error(
        `Registry packument for ${name} does not list version ${version} after ${retries + 1} attempts`,
      )
    }

    await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)))
  }
}

/**
 * Mirrors pnpm's `getTrustEvidence()`: the `trustedPublisher` tier needs both a
 * trusted-publisher marker and a provenance attestation.
 *
 * @returns {string[]} the failures found for one package
 */
export function checkManifest(name, version, manifest) {
  const failures = []

  if (manifest.version !== version) {
    failures.push(`registry reports version ${manifest.version}, expected ${version}`)
  }

  if (manifest._npmUser?.trustedPublisher === undefined) {
    failures.push(
      'no `_npmUser.trustedPublisher` — the version was NOT published through a trusted publisher. ' +
        'The OIDC exchange most likely failed and pnpm fell back to another credential; ' +
        'check the publish step logs for a `Skipped OIDC` warning.',
    )
  }

  if (manifest.dist?.attestations?.provenance === undefined) {
    failures.push(
      'no `dist.attestations.provenance` — the version carries no provenance attestation',
    )
  }

  for (const [dependency, range] of Object.entries(manifest.dependencies ?? {})) {
    if (typeof range === 'string' && range.startsWith('workspace:')) {
      failures.push(
        `dependency ${dependency} was published as "${range}"; a workspace range cannot be resolved from the registry`,
      )
    }
  }

  return failures.map((failure) => `  ${name}@${version}: ${failure}`)
}

/** The four public packages are a fixed Changesets group, so versions must agree. */
export function checkVersionAlignment(published) {
  const versions = [...new Set(published.map(({ version }) => version))]
  return versions.length > 1
    ? [`  release is not version-aligned across the family: found ${versions.join(', ')}`]
    : []
}

async function main() {
  const published = readPublishedPackages()

  const manifests = await Promise.all(
    published.map(async ({ name, version }) => ({
      name,
      version,
      manifest: await fetchRegistryManifest(name, version),
    })),
  )

  const failures = [
    ...manifests.flatMap(({ name, version, manifest }) => checkManifest(name, version, manifest)),
    ...checkVersionAlignment(published),
  ]

  if (failures.length > 0) {
    console.error(`Release trust verification FAILED for ${published.length} package(s):\n`)
    console.error(failures.join('\n'))
    console.error(
      '\nA published npm version cannot be replaced. Do not retry this version — ' +
        'fix the trusted-publisher configuration and release the next coordinated version.',
    )
    process.exit(1)
  }

  console.log(
    `Release trust verified for ${published.length} package(s) at version ${published[0].version}:`,
  )
  for (const { name, version } of published) {
    console.log(`  ${name}@${version} — trusted publisher + provenance attestation`)
  }
}

// Allow the checks to be imported by tests without performing a release check.
if (process.env.PUBLISHED_PACKAGES !== undefined) {
  await main()
}

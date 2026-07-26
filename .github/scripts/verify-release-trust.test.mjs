// Offline checks for the release trust verifier. Run: node --test .github/scripts/
//
// The shapes below are real registry responses, trimmed. The `_npmUser` shape is
// the reason this verifier reads the packument directly: `npm view` renders that
// field as a display string and drops the nested `trustedPublisher` object.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  checkManifest,
  checkVersionAlignment,
  fetchRegistryManifest,
} from './verify-release-trust.mjs'

/** Shape of a version trusted-published from GitHub Actions (as @changesets/cli 2.31.1). */
const trusted = {
  version: '0.2.0',
  _npmUser: {
    name: 'GitHub Actions',
    email: 'npm-oidc-no-reply@github.com',
    trustedPublisher: { id: 'github', oidcConfigId: 'oidc:00000000' },
  },
  dist: {
    attestations: { provenance: { predicateType: 'https://slsa.dev/provenance/v1' } },
  },
  dependencies: { '@text-rendering-toolkit/font': '^0.2.0' },
}

test('accepts a trusted publish with provenance', () => {
  assert.deepEqual(checkManifest('@text-rendering-toolkit/layout', '0.2.0', trusted), [])
})

test('rejects a manually published version', () => {
  // Exactly the shape of the hand-bootstrapped 0.1.1 releases.
  const manual = {
    version: '0.2.0',
    _npmUser: { name: 'juliascript', email: 'contato@juliaortiz.com.br' },
    dist: { signatures: [{ keyid: 'SHA256:abc' }] },
  }

  const failures = checkManifest('@text-rendering-toolkit/font', '0.2.0', manual)
  assert.equal(failures.length, 2)
  assert.match(failures[0], /trustedPublisher/)
  assert.match(failures[0], /Skipped OIDC/)
  assert.match(failures[1], /provenance/)
})

test('rejects provenance without a trusted publisher', () => {
  // The weaker `provenance` tier: attested, but not via a trusted publisher.
  const failures = checkManifest('@text-rendering-toolkit/sdf', '0.2.0', {
    ...trusted,
    _npmUser: { name: 'someone', email: 'someone@example.com' },
  })

  assert.equal(failures.length, 1)
  assert.match(failures[0], /trustedPublisher/)
})

test('rejects a version mismatch', () => {
  const failures = checkManifest('@text-rendering-toolkit/font', '0.2.0', {
    ...trusted,
    version: '0.1.1',
  })
  assert.equal(failures.length, 1)
  assert.match(failures[0], /reports version 0\.1\.1, expected 0\.2\.0/)
})

test('rejects a workspace range that survived publication', () => {
  const failures = checkManifest('@text-rendering-toolkit/three-webgpu', '0.2.0', {
    ...trusted,
    dependencies: { '@text-rendering-toolkit/layout': 'workspace:^', three: '^0.185.1' },
  })

  assert.equal(failures.length, 1)
  assert.match(failures[0], /workspace:\^/)
  assert.match(failures[0], /cannot be resolved from the registry/)
})

test('tolerates a manifest with no dependencies', () => {
  const { dependencies, ...noDeps } = trusted
  assert.deepEqual(checkManifest('@text-rendering-toolkit/font', '0.2.0', noDeps), [])
})

test('accepts an aligned family and rejects a split one', () => {
  const family = ['font', 'layout', 'sdf', 'three-webgpu'].map((name) => ({
    name: `@text-rendering-toolkit/${name}`,
    version: '0.2.0',
  }))

  assert.deepEqual(checkVersionAlignment(family), [])

  const split = [
    ...family.slice(0, 3),
    { name: '@text-rendering-toolkit/three-webgpu', version: '0.2.1' },
  ]
  const failures = checkVersionAlignment(split)
  assert.equal(failures.length, 1)
  assert.match(failures[0], /not version-aligned/)
})

test('retries while a freshly published version is missing from the packument', async () => {
  let calls = 0
  const fetchImpl = async () => {
    calls++
    return {
      ok: true,
      json: async () => (calls < 3 ? { versions: {} } : { versions: { '0.2.0': trusted } }),
    }
  }

  const manifest = await fetchRegistryManifest('@text-rendering-toolkit/font', '0.2.0', {
    fetchImpl,
    retries: 5,
  })

  assert.equal(calls, 3)
  assert.equal(manifest.version, '0.2.0')
})

test('gives up when the version never appears', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ versions: {} }) })

  await assert.rejects(
    () => fetchRegistryManifest('@text-rendering-toolkit/font', '0.2.0', { fetchImpl, retries: 0 }),
    /does not list version 0\.2\.0/,
  )
})

test('surfaces a registry error rather than passing silently', async () => {
  const fetchImpl = async () => ({ ok: false, status: 503, json: async () => ({}) })

  await assert.rejects(
    () => fetchRegistryManifest('@text-rendering-toolkit/font', '0.2.0', { fetchImpl, retries: 0 }),
    /returned 503/,
  )
})

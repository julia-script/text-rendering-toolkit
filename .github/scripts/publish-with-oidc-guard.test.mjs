// Offline checks for the publish OIDC guard. Run: pnpm test:scripts

import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { test } from 'node:test'

import { publishWithGuard, runPublish } from './publish-with-oidc-guard.mjs'

/** Minimal stand-in for a spawned child emitting the given stdout/stderr. */
function fakeSpawn({ stdout = '', stderr = '', code = 0 }) {
  return () => {
    const child = new EventEmitter()
    child.stdout = Readable.from([stdout])
    child.stderr = Readable.from([stderr])

    // Close only after both streams have drained.
    let open = 2
    const done = () => {
      if (--open === 0) setImmediate(() => child.emit('close', code))
    }
    child.stdout.on('end', done)
    child.stderr.on('end', done)

    return child
  }
}

test('forwards every chunk of stdout to the caller', async () => {
  // changesets/action parses this stdout; losing it silently disables the
  // registry verification and the GitHub releases.
  const publishOutput = 'New tag:  @text-rendering-toolkit/font@0.2.0\n'
  let seen = ''

  const code = await runPublish('pnpm', ['run', 'release:publish'], {
    onOutput: (chunk) => {
      seen += chunk
    },
    spawnImpl: fakeSpawn({ stdout: publishOutput }),
  })

  assert.equal(code, 0)
  assert.equal(seen, publishOutput)
})

test('passes a clean publish through', async () => {
  const result = await publishWithGuard({
    spawnImpl: fakeSpawn({ stdout: 'New tag:  @text-rendering-toolkit/font@0.2.0\n' }),
  })

  assert.deepEqual(result, { exitCode: 0, skippedOidc: false })
})

test('detects the warning on stdout', async () => {
  const result = await publishWithGuard({
    spawnImpl: fakeSpawn({
      stdout: 'Skipped OIDC: no token available\nNew tag:  @text-rendering-toolkit/font@0.2.0\n',
    }),
  })

  // The publish itself "succeeded" — that is exactly the dangerous case.
  assert.equal(result.exitCode, 0)
  assert.equal(result.skippedOidc, true)
})

test('detects the warning on stderr', async () => {
  const result = await publishWithGuard({
    spawnImpl: fakeSpawn({ stderr: 'Skipped OIDC: Failed token exchange request\n' }),
  })

  assert.equal(result.skippedOidc, true)
})

test('propagates a failing exit code', async () => {
  const result = await publishWithGuard({
    spawnImpl: fakeSpawn({ stderr: 'ENEEDAUTH\n', code: 1 }),
  })

  assert.equal(result.exitCode, 1)
  assert.equal(result.skippedOidc, false)
})

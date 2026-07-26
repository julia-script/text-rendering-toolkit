// Runs `changeset publish` and fails the release if pnpm skipped the OIDC exchange.
//
// pnpm performs the npm trusted-publishing token exchange itself, but when it fails
// pnpm only warns — `Skipped OIDC: <reason>` — and continues with whatever other
// credential is reachable. The publish can therefore succeed while producing an
// untrusted version, and the warning is the only signal at that moment.
//
// The warning appears on the publish command's own output, so it has to be caught
// here: a GitHub Actions step output cannot carry it.
//
// stdout MUST be forwarded through byte-for-byte. changesets/action parses it to
// build its `published` and `publishedPackages` outputs, which in turn drive the
// registry verification and the GitHub releases. Swallowing it would silently
// disable both.

import { spawn } from 'node:child_process'

const WARNING = 'Skipped OIDC'

/**
 * @param {(chunk: string) => void} onOutput receives every chunk of combined output
 * @returns {Promise<number>} the child's exit code
 */
export function runPublish(command, args, { onOutput, spawnImpl = spawn } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl(command, args, { stdio: ['inherit', 'pipe', 'pipe'] })

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')

    // Forward each stream to its own destination so the action still sees a clean
    // stdout, while both streams are inspected for the warning.
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk)
      onOutput(chunk)
    })

    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk)
      onOutput(chunk)
    })

    child.on('error', reject)
    child.on('close', (code) => resolve(code ?? 0))
  })
}

/** @returns {{exitCode: number, skippedOidc: boolean}} */
export async function publishWithGuard({ spawnImpl } = {}) {
  let combined = ''
  const exitCode = await runPublish('pnpm', ['run', 'release:publish'], {
    onOutput: (chunk) => {
      combined += chunk
    },
    spawnImpl,
  })

  return { exitCode, skippedOidc: combined.includes(WARNING) }
}

// Only act as a CLI when invoked directly, so the helpers stay testable.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { exitCode, skippedOidc } = await publishWithGuard()

  if (skippedOidc) {
    process.stderr.write(
      '\n::error::pnpm reported "Skipped OIDC" — the npm token exchange failed, so publication ' +
        'did not use a trusted publisher. Verify the trusted-publisher configuration for every ' +
        'package (owner, repository, and workflow filename must match exactly); see ' +
        'docs/RELEASING.md.\n',
    )
    process.exit(1)
  }

  process.exit(exitCode)
}

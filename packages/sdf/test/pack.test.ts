import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = resolve(packageRoot, '../..')

test('ships an independent ESM and TypeScript package', () => {
  const temporary = mkdtempSync(resolve(tmpdir(), 'text-rendering-toolkit-sdf-pack-'))
  try {
    execFileSync('pnpm', ['pack', '--pack-destination', temporary], {
      cwd: packageRoot,
      stdio: 'pipe',
    })
    const archive = readdirSync(temporary).find((file) => file.endsWith('.tgz'))
    expect(archive).toBeDefined()

    const consumer = resolve(temporary, 'consumer')
    mkdirSync(consumer)
    writeFileSync(
      resolve(consumer, 'package.json'),
      JSON.stringify({ private: true, type: 'module' }, null, 2),
    )
    execFileSync('pnpm', ['add', '--ignore-scripts', resolve(temporary, archive ?? '')], {
      cwd: consumer,
      stdio: 'pipe',
    })

    const installed = resolve(consumer, 'node_modules/@text-rendering-toolkit/sdf')
    for (const file of [
      'dist/index.js',
      'dist/index.d.ts',
      'README.md',
      'THIRD_PARTY_NOTICES.md',
      'LICENSE.webgl-sdf-generator.txt',
    ]) {
      expect(existsSync(resolve(installed, file))).toBe(true)
    }

    writeFileSync(
      resolve(consumer, 'main.ts'),
      `
        import { generateSdf, SdfCommand } from '@text-rendering-toolkit/sdf'
        import type { GenerateSdfInput } from '@text-rendering-toolkit/sdf'
        const input: GenerateSdfInput = {
          outline: {
            commands: Uint8Array.from([SdfCommand.MOVE_TO, SdfCommand.LINE_TO]),
            coordinates: Float32Array.from([-1, 0, 1, 0]),
          },
          viewBox: { left: -1, bottom: -1, right: 1, top: 1 },
          width: 3, height: 3, distance: 1, exponent: 1,
        }
        if (generateSdf(input).pixels.length !== 9) throw new Error('Unexpected bitmap')
      `,
    )
    writeFileSync(
      resolve(consumer, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            strict: true,
            noEmit: true,
          },
          include: ['main.ts'],
        },
        2,
      ),
    )
    execFileSync(resolve(workspaceRoot, 'node_modules/.bin/tsc'), ['-p', 'tsconfig.json'], {
      cwd: consumer,
      stdio: 'pipe',
    })
    execFileSync(process.execPath, ['--experimental-strip-types', 'main.ts'], {
      cwd: consumer,
      stdio: 'pipe',
    })
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
})

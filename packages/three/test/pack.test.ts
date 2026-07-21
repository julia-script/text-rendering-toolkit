import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = resolve(packageRoot, '../..')

function pack(root: string, destination: string): string {
  mkdirSync(destination)
  execFileSync('pnpm', ['pack', '--pack-destination', destination], {
    cwd: root,
    stdio: 'pipe',
  })
  const archive = readdirSync(destination).find((file) => file.endsWith('.tgz'))
  if (!archive) throw new Error(`Packing ${root} did not create an archive`)
  return resolve(destination, archive)
}

test('ships public ESM runtime and declarations to a clean consumer', () => {
  const temporary = mkdtempSync(resolve(tmpdir(), 'webgpu-text-three-pack-'))
  try {
    const archives = ['font', 'layout', 'sdf', 'three'].map((name) =>
      pack(resolve(workspaceRoot, 'packages', name), resolve(temporary, name)),
    )
    const consumer = resolve(temporary, 'consumer')
    mkdirSync(consumer)
    writeFileSync(
      resolve(consumer, 'package.json'),
      JSON.stringify({ private: true, type: 'module' }, null, 2),
    )
    execFileSync('npm', ['install', '--ignore-scripts', '--legacy-peer-deps', ...archives], {
      cwd: consumer,
      stdio: 'pipe',
    })
    symlinkSync(resolve(packageRoot, 'node_modules/three'), resolve(consumer, 'node_modules/three'))
    mkdirSync(resolve(consumer, 'node_modules/@types'), { recursive: true })
    symlinkSync(
      resolve(packageRoot, 'node_modules/@types/three'),
      resolve(consumer, 'node_modules/@types/three'),
    )

    const installed = resolve(consumer, 'node_modules/@webgpu-text/three')
    for (const file of ['dist/index.js', 'dist/index.d.ts', 'README.md']) {
      expect(existsSync(resolve(installed, file))).toBe(true)
    }
    const manifest = JSON.parse(readFileSync(resolve(installed, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
    }
    expect(
      Object.values(manifest.dependencies).every((value) => !value.startsWith('workspace:')),
    ).toBe(true)

    writeFileSync(
      resolve(consumer, 'main.ts'),
      `
        import { Text, InvalidTextInputError } from '@webgpu-text/three'
        import type { TextFont, TextOptions } from '@webgpu-text/three'
        const font: TextFont = {
          facts: { unitsPerEm: 1000 },
          getOutline: () => ({
            commands: new Uint8Array(), coordinates: new Float32Array(),
            bounds: { xMin: 0, yMin: 0, xMax: 0, yMax: 0 },
          }),
        }
        const options = {} as TextOptions
        void font
        void options
        if (typeof Text !== 'function' || typeof InvalidTextInputError !== 'function') {
          throw new Error('Missing public renderer exports')
        }
      `,
    )
    writeFileSync(
      resolve(consumer, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            lib: ['ES2023', 'DOM'],
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            strict: true,
            noEmit: true,
            skipLibCheck: true,
          },
          include: ['main.ts'],
        },
        null,
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

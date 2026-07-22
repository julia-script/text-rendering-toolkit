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
    const packageNames = ['font', 'layout', 'sdf', 'three'] as const
    const archives = packageNames.map((name) =>
      pack(resolve(workspaceRoot, 'packages', name), resolve(temporary, name)),
    )
    const dependencies = Object.fromEntries(
      packageNames.map((name, index) => [`@webgpu-text/${name}`, `file:${archives[index]}`]),
    )
    const consumer = resolve(temporary, 'consumer')
    mkdirSync(consumer)
    writeFileSync(
      resolve(consumer, 'package.json'),
      JSON.stringify({ private: true, type: 'module', dependencies }, null, 2),
    )
    writeFileSync(
      resolve(consumer, 'pnpm-workspace.yaml'),
      `packages:\n  - .\nautoInstallPeers: false\noverrides:\n${Object.entries(dependencies)
        .map(([name, archive]) => `  '${name}': ${archive}`)
        .join('\n')}\n`,
    )
    execFileSync('pnpm', ['install', '--ignore-scripts'], {
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
        import { Text, TextResources, InvalidTextInputError } from '@webgpu-text/three'
        import type {
          TextColorGlyphLayer,
          TextFont,
          TextMaterial,
          TextOptions,
          TextResourcesOptions,
          TextRgbaColor,
        } from '@webgpu-text/three'
        const red = { red: 255, green: 0, blue: 0, alpha: 128 } satisfies TextRgbaColor
        const layers = [{ glyphId: 1, color: red }] satisfies readonly TextColorGlyphLayer[]
        const font: TextFont = {
          getOutline: () => ({
            commands: new Uint8Array(), coordinates: new Float32Array(),
            bounds: { xMin: 0, yMin: 0, xMax: 0, yMax: 0 },
          }),
          getColorLayers: () => layers,
        }
        const options = { lit: true } as TextOptions
        const resourceOptions = { sdfSize: 16 } satisfies TextResourcesOptions
        const resources = new TextResources(resourceOptions)
        const material = null as TextMaterial | null
        void font
        void options
        void material
        resources.dispose()
        if (typeof Text !== 'function' || typeof TextResources !== 'function' || typeof InvalidTextInputError !== 'function') {
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

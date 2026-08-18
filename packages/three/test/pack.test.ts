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
  const temporary = mkdtempSync(resolve(tmpdir(), 'text-rendering-toolkit-three-pack-'))
  try {
    const packageNames = ['font', 'layout', 'linebreak', 'sdf', 'three'] as const
    const archives = packageNames.map((name) =>
      pack(resolve(workspaceRoot, 'packages', name), resolve(temporary, name)),
    )
    const dependencies = Object.fromEntries(
      packageNames.map((name, index) => [
        `@text-rendering-toolkit/${name === 'three' ? 'three-webgpu' : name}`,
        `file:${archives[index]}`,
      ]),
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

    const installed = resolve(consumer, 'node_modules/@text-rendering-toolkit/three-webgpu')
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
        import type { LayoutResult } from '@text-rendering-toolkit/layout'
        import { Text, TextResources, InvalidTextInputError } from '@text-rendering-toolkit/three-webgpu'
        import type {
          TextColorGlyphLayer,
          TextFont,
          TextMaterial,
          TextOptions,
          TextOutline,
          TextResourcesOptions,
          TextRgbaColor,
          TextShadow,
        } from '@text-rendering-toolkit/three-webgpu'
        const red = { red: 255, green: 0, blue: 0, alpha: 128 } satisfies TextRgbaColor
        const layers = [{ glyphId: 1, color: red }] satisfies readonly TextColorGlyphLayer[]
        const font: TextFont = {
          facts: { unitsPerEm: 1000 },
          getOutline: () => ({
            commands: new Uint8Array(), coordinates: new Float32Array(),
            bounds: { xMin: 0, yMin: 0, xMax: 0, yMax: 0 },
          }),
          getColorLayers: () => layers,
        }
        const options = { lit: true } as TextOptions
        const outline = { width: 0.02, color: 0xff0000, opacity: 0.8 } satisfies TextOutline
        const shadow = {
          offsetX: 0.01, offsetY: -0.01, softness: 0.01, color: 0x000000, opacity: 0.5,
        } satisfies TextShadow
        const resourceOptions = { sdfSize: 16, sdfPadding: 0.25 } satisfies TextResourcesOptions
        const resources = new TextResources(resourceOptions)
        const layout = {
          glyphs: [], blockBounds: { left: 0, bottom: 0, right: 0, top: 0 },
        } as unknown as LayoutResult
        const text = new Text({ layout, fonts: new Map([['font', font]]), resources, outline, shadow })
        await text.sync()
        text.outline = null
        text.shadow = { ...shadow, offsetX: 0.02 }
        await text.sync()
        const material = null as TextMaterial | null
        void font
        void options
        void material
        text.dispose()
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
}, 15_000)

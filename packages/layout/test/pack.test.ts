import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fontRoot = resolve(packageRoot, '../font')
const workspaceRoot = resolve(packageRoot, '../..')

function pack(root: string, destination: string): string {
  mkdirSync(destination)
  execFileSync('pnpm', ['pack', '--pack-destination', destination], {
    cwd: root,
    stdio: 'pipe',
  })
  const archive = readdirSync(destination)
    .filter((file) => file.endsWith('.tgz'))
    .sort()
    .at(-1)
  if (!archive) throw new Error(`Packing ${root} did not create an archive`)
  return resolve(destination, archive)
}

it('ships ESM runtime and type exports usable with the public font package', () => {
  const temporary = mkdtempSync(resolve(tmpdir(), 'webgpu-text-layout-pack-'))
  try {
    const fontArchive = pack(fontRoot, resolve(temporary, 'font'))
    const layoutArchive = pack(packageRoot, resolve(temporary, 'layout'))
    const consumer = resolve(temporary, 'consumer')
    mkdirSync(consumer)
    writeFileSync(
      resolve(consumer, 'package.json'),
      JSON.stringify({ private: true, type: 'module' }, null, 2),
    )
    execFileSync('npm', ['install', '--ignore-scripts', fontArchive, layoutArchive], {
      cwd: consumer,
      stdio: 'pipe',
    })

    const installed = resolve(consumer, 'node_modules/@webgpu-text/layout')
    expect(existsSync(resolve(installed, 'dist/index.js'))).toBe(true)
    expect(existsSync(resolve(installed, 'dist/index.d.ts'))).toBe(true)

    const source = `
      import { layoutResolvedText, getSelectionRects } from '@webgpu-text/layout'
      import type { ResolvedLayoutInput } from '@webgpu-text/layout'

      const input: ResolvedLayoutInput = {
        text: '', paragraphLevel: 0, defaultMetrics: { ascender: 8, descender: -2, lineGap: 0 },
        maxWidth: null, whiteSpace: 'normal', overflowWrap: 'normal', textAlign: 'left',
        textIndent: 0, letterSpacing: 0, lineHeight: 'normal', anchorX: 'left',
        anchorY: 'top-baseline', runs: [],
      }
      const result = layoutResolvedText(input)
      getSelectionRects(result, { start: 0, end: 0 })
      if (result.sourceLengthUtf16 !== 0) throw new Error('Unexpected source length')
    `
    writeFileSync(resolve(consumer, 'main.ts'), source)
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

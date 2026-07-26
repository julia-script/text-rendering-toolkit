import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as layout from '@text-rendering-toolkit/layout'
import * as sdf from '@text-rendering-toolkit/sdf'
import { expect, test } from 'vitest'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = resolve(packageRoot, '../..')

function sources(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(root, entry.name)
    return entry.isDirectory() ? sources(path) : entry.name.endsWith('.ts') ? [path] : []
  })
}

test('resolves the renderer workspace dependencies', () => {
  expect(layout).toBeDefined()
  expect(sdf).toBeDefined()
})

test('keeps Three and browser/rendering concerns inside the renderer boundary', () => {
  for (const name of ['font', 'layout', 'sdf']) {
    for (const file of sources(resolve(workspaceRoot, 'packages', name, 'src'))) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/from ['"]three(?:\/|['"])/u)
    }
  }

  const rendererSource = sources(resolve(packageRoot, 'src'))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n')
  for (const forbidden of [
    'ShaderMaterial',
    'onBeforeCompile',
    'WebGL',
    'three/src',
    'document.',
    'window.',
    'fetch(',
    'experiments/webgpu-rendering-seam',
    'old/',
  ]) {
    expect(rendererSource).not.toContain(forbidden)
  }
  expect(readFileSync(resolve(packageRoot, 'src/index.ts'), 'utf8')).not.toMatch(
    /\.\/(?:atlas|rendering)\.js/u,
  )
})

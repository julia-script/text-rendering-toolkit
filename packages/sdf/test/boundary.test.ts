import { readdir, readFile } from 'node:fs/promises'
import { expect, test } from 'vitest'

test('keeps production source independent of excluded layers', async () => {
  const sourceRoot = new URL('../src/', import.meta.url)
  const files = (await readdir(sourceRoot)).filter((file) => file.endsWith('.ts'))
  const source = (
    await Promise.all(files.map((file) => readFile(new URL(file, sourceRoot), 'utf8')))
  ).join('\n')
  expect(source).not.toMatch(/(?:from\s+|import\s*\()['"][^'"]*(?:old\/|webgl-sdf-generator)/)
  expect(source).not.toMatch(/@webgpu-text\/(?:font|layout|three)/)
  expect(source).not.toMatch(
    /(?:\bwindow\.|\bdocument\.|HTMLCanvasElement|OffscreenCanvas|WebGL|WebGPU|three\/webgpu|\bWorker\b|\batlas\b)/,
  )
})

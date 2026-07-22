import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fixture = resolve(
  packageRoot,
  '../../test-fixtures/fonts/harfbuzz-validation/NotoSans-wdth-wght.ttf',
)
const colorFixture = resolve(
  packageRoot,
  '../../test-fixtures/fonts/color-glyph-validation/noto-validation-colr-v0.ttf',
)

it('ships a self-contained ESM package', () => {
  const temporary = mkdtempSync(resolve(tmpdir(), 'webgpu-text-font-pack-'))
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
    execFileSync('npm', ['install', '--ignore-scripts', resolve(temporary, archive ?? '')], {
      cwd: consumer,
      stdio: 'pipe',
    })

    const installed = resolve(consumer, 'node_modules/@webgpu-text/font')
    expect(existsSync(resolve(installed, 'dist/index.js'))).toBe(true)
    expect(existsSync(resolve(installed, 'dist/index.d.ts'))).toBe(true)
    expect(existsSync(resolve(installed, 'dist/internal/vendor/harfbuzz.wasm'))).toBe(true)
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `
          import { readFile } from 'node:fs/promises'
          import { loadFont } from '@webgpu-text/font'
          const bytes = await readFile(${JSON.stringify(fixture)})
          const font = await loadFont(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength))
          const run = font.shape({ text: 'office', direction: 'ltr', script: 'Latn', language: 'en' })
          const outline = font.getOutline(run.glyphs[0].glyphId)
          if (run.glyphs.length === 0 || outline.commands.length === 0) process.exit(1)
          font.dispose()

          const colorBytes = await readFile(${JSON.stringify(colorFixture)})
          const colorFont = await loadFont(new Uint8Array(
            colorBytes.buffer,
            colorBytes.byteOffset,
            colorBytes.byteLength,
          ))
          const colorRun = colorFont.shape({
            text: '😀',
            direction: 'ltr',
            script: 'Zyyy',
            language: 'und',
          })
          const layers = colorFont.getColorLayers(colorRun.glyphs[0].glyphId)
          if (!layers?.length || layers.some((layer) => colorFont.getOutline(layer.glyphId).commands.length === 0)) {
            process.exit(1)
          }
          colorFont.dispose()
        `,
      ],
      { cwd: consumer, stdio: 'pipe' },
    )
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
})

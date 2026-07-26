import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const documents = [
  'ARCHITECTURE.md',
  'ROADMAP.md',
  'docs/validation/unicode-line-breaking.md',
  'docs/validation/renderer-neutral-text-decorations.md',
]
const appRoot = resolve(import.meta.dirname, '..')
const repositoryRoot = resolve(appRoot, '../..')
const outputRoot = resolve(appRoot, 'public/repository')

rmSync(outputRoot, { force: true, recursive: true })
for (const document of documents) {
  const output = resolve(outputRoot, document)
  mkdirSync(dirname(output), { recursive: true })
  cpSync(resolve(repositoryRoot, document), output)
}

cpSync(
  resolve(repositoryRoot, 'test-fixtures/fonts/color-glyph-validation/noto-validation-colr-v0.ttf'),
  resolve(appRoot, 'public/fonts/noto-validation-colr-v0.ttf'),
)
cpSync(
  resolve(repositoryRoot, 'test-fixtures/fonts/color-glyph-validation/LICENSE'),
  resolve(appRoot, 'public/fonts/NotoEmoji-LICENSE.txt'),
)

import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const documents = [
  'ARCHITECTURE.md',
  'ROADMAP.md',
  'docs/validation/harfbuzz-font-engine.md',
  'docs/validation/text-preparation-boundary.md',
  'docs/validation/three-webgpu-text-core.md',
  'docs/validation/lit-text-shadow-seam.md',
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

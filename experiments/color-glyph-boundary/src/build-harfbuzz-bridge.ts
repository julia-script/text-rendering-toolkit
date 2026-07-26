import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { colorExportInventory, productionRuntimeInventory, wasmExportNames } from './runtime.js'

const root = fileURLToPath(new URL('../../../..', import.meta.url))
const experiment = resolve(root, 'experiments/color-glyph-boundary')
const source = resolve(experiment, '.cache/harfbuzzjs')
const output = resolve(experiment, 'artifacts/harfbuzz-bridge.json')
const wrapperRevision = 'e55f3ce887a1a5437d8e7a3a3730123c7a49a5f6'
const requiredSymbols = [
  '_hb_ot_color_glyph_get_layers',
  '_hb_ot_color_glyph_has_paint',
  '_hb_ot_color_glyph_reference_png',
  '_hb_ot_color_glyph_reference_svg',
  '_hb_ot_color_has_layers',
  '_hb_ot_color_has_paint',
  '_hb_ot_color_has_palettes',
  '_hb_ot_color_has_png',
  '_hb_ot_color_has_svg',
  '_hb_ot_color_palette_get_colors',
  '_hb_ot_color_palette_get_count',
] as const

async function command(program: string, args: readonly string[], cwd = root) {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(program, args, { cwd, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`${program} exited with ${String(code)}`))
    })
  })
}

async function ensureSource() {
  try {
    await readFile(resolve(source, 'Makefile'))
  } catch {
    await mkdir(resolve(experiment, '.cache'), { recursive: true })
    await command('git', ['clone', 'https://github.com/harfbuzz/harfbuzzjs.git', source])
  }
  await command('git', ['checkout', '--detach', wrapperRevision], source)
  await command('git', ['submodule', 'update', '--init', '--depth', '1'], source)
}

async function configureColorBuild() {
  const overridePath = resolve(source, 'config-override.h')
  const original = await readFile(overridePath, 'utf8')
  const marker = '/* color-glyph-boundary experiment */'
  if (!original.includes(marker)) {
    await writeFile(
      overridePath,
      `${original.trimEnd()}\n${marker}\n#undef HB_NO_COLOR\n#undef HB_NO_PAINT\n#undef HB_NO_BITMAP\n#undef HB_NO_SVG\n`,
    )
  }
  const symbolsPath = resolve(source, 'harfbuzz.symbols')
  const symbols = await readFile(symbolsPath, 'utf8')
  const additions = requiredSymbols.filter((symbol) => !symbols.split(/\s+/u).includes(symbol))
  if (additions.length > 0) {
    await writeFile(symbolsPath, `${symbols.trimEnd()}\n${additions.join('\n')}\n`)
  }
}

interface HarfBuzzModule {
  readonly HEAPU8: Uint8Array
  _malloc(size: number): number
  _free(pointer: number): void
  _hb_blob_create(
    data: number,
    length: number,
    mode: number,
    userData: number,
    destroy: number,
  ): number
  _hb_blob_destroy(blob: number): void
  _hb_face_create(blob: number, index: number): number
  _hb_face_destroy(face: number): void
  _hb_ot_color_has_layers(face: number): number
  _hb_ot_color_palette_get_count(face: number): number
}

async function instantiate(modulePath: string, wasmPath: string): Promise<HarfBuzzModule> {
  const imported = (await import(`${pathToFileURL(modulePath).href}?validation=${Date.now()}`)) as {
    default(options: { locateFile(path: string): string }): Promise<HarfBuzzModule>
  }
  return imported.default({ locateFile: (path) => (path.endsWith('.wasm') ? wasmPath : path) })
}

async function verifyColorCalls(module: HarfBuzzModule) {
  const fixture = await readFile(
    resolve(root, 'test-fixtures/fonts/color-glyph-validation/noto-validation-colr-v0.ttf'),
  )
  const pointer = module._malloc(fixture.length)
  module.HEAPU8.set(fixture, pointer)
  const blob = module._hb_blob_create(pointer, fixture.length, 0, 0, 0)
  const face = module._hb_face_create(blob, 0)
  try {
    const hasLayers = module._hb_ot_color_has_layers(face) !== 0
    const paletteCount = module._hb_ot_color_palette_get_count(face)
    if (!hasLayers || paletteCount !== 1) {
      throw new Error(`unexpected bridge result: layers=${hasLayers}, palettes=${paletteCount}`)
    }
    return { hasLayers, paletteCount }
  } finally {
    module._hb_face_destroy(face)
    module._hb_blob_destroy(blob)
    module._free(pointer)
  }
}

async function main() {
  const production = await productionRuntimeInventory(root)
  await ensureSource()
  await configureColorBuild()
  await command('make', ['harfbuzz'], source)
  const wasmPath = resolve(source, 'dist/harfbuzz.wasm')
  const modulePath = resolve(source, 'dist/harfbuzz.js')
  const bytes = await readFile(wasmPath)
  const exports = wasmExportNames(bytes)
  const inventory = colorExportInventory(exports)
  if (Object.values(inventory).some((present) => !present)) {
    throw new Error('rebuilt bridge is missing one or more requested color exports')
  }
  const module = await instantiate(modulePath, wasmPath)
  const representativeCall = await verifyColorCalls(module)
  await mkdir(resolve(experiment, 'artifacts'), { recursive: true })
  await writeFile(
    output,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        kind: 'harfbuzz-color-bridge',
        source: `harfbuzzjs@${wrapperRevision}`,
        buildCommand:
          'pnpm --filter @text-rendering-toolkit/color-glyph-boundary-experiment bridge:build',
        configDelta: [
          'undef HB_NO_COLOR',
          'undef HB_NO_PAINT',
          'undef HB_NO_BITMAP',
          'undef HB_NO_SVG',
          ...requiredSymbols.map((symbol) => `export ${symbol.slice(1)}`),
        ],
        production: {
          bytes: production.wasmBytes,
          sha256: production.wasmSha256,
          colorExports: colorExportInventory(production.exports),
        },
        rebuilt: {
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
          byteDelta: bytes.length - production.wasmBytes,
          colorExports: inventory,
          nodeEsmInitialization: 'pass',
          browserEsmInitialization: 'checked by color-glyph browser suite',
          representativeCall,
          lifecycle:
            'Emscripten module is realm-owned; font/blob/face payload objects remain explicit',
        },
      },
      null,
      2,
    )}\n`,
  )
}

await main()

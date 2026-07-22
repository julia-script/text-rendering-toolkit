import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { RuntimeInventory } from './schema.js'

const COLOR_EXPORTS = [
  'hb_ot_color_glyph_get_layers',
  'hb_ot_color_glyph_has_paint',
  'hb_ot_color_glyph_reference_png',
  'hb_ot_color_glyph_reference_svg',
  'hb_ot_color_has_layers',
  'hb_ot_color_has_paint',
  'hb_ot_color_has_palettes',
  'hb_ot_color_has_png',
  'hb_ot_color_has_svg',
  'hb_ot_color_palette_get_colors',
  'hb_ot_color_palette_get_count',
] as const

export function wasmExportNames(bytes: Uint8Array): readonly string[] {
  const moduleBytes = bytes.slice().buffer
  return Object.freeze(
    WebAssembly.Module.exports(new WebAssembly.Module(moduleBytes))
      .map((item) => item.name)
      .sort(),
  )
}

export function colorExportInventory(exports: readonly string[]) {
  return Object.freeze(
    Object.fromEntries(COLOR_EXPORTS.map((name) => [name, exports.includes(name)])),
  )
}

export async function productionRuntimeInventory(root: string): Promise<RuntimeInventory> {
  const wasmPath = resolve(root, 'packages/font/src/internal/vendor/harfbuzz.wasm')
  const bytes = await readFile(wasmPath)
  return Object.freeze({
    wrapperVersion: '1.4.0',
    wrapperRevision: 'e55f3ce887a1a5437d8e7a3a3730123c7a49a5f6',
    harfbuzzVersion: '14.2.1',
    harfbuzzRevision: '56feae4035bdd48f62ba2b8d8c16232d4d89b3a4',
    wasmSha256: createHash('sha256').update(bytes).digest('hex'),
    wasmBytes: bytes.length,
    exports: wasmExportNames(bytes),
    buildFlags: Object.freeze([
      '-Oz',
      '-flto',
      '-DHB_TINY',
      '-DHB_EXPERIMENTAL_API',
      '-s ALLOW_MEMORY_GROWTH',
      'config override re-enables draw, CFF, variation, name, and metrics only',
      'HB_TINY leaves HB_NO_COLOR, HB_NO_PAINT, HB_NO_BITMAP, and HB_NO_SVG enabled',
    ]),
  })
}

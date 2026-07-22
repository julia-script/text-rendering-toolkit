import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadFont } from '@webgpu-text/font'
import { layoutPreparedText, prepareText } from '@webgpu-text/layout'
import { Text } from '@webgpu-text/three'
import { describe, expect, test } from 'vitest'
import { ColrV0TextResources } from '../src/colr-v0.js'

const root = fileURLToPath(new URL('../../..', import.meta.url))
const fixturePath = resolve(
  root,
  'test-fixtures/fonts/color-glyph-validation/noto-validation-colr-v0.ttf',
)

describe('private COLR v0 seam', () => {
  test('resolves lazily, expands layers, and keys pixel-affecting inputs', async () => {
    const bytes = await readFile(fixturePath)
    const font = await loadFont(bytes)
    const layout = layoutPreparedText(
      prepareText({
        text: '😀😀',
        style: { key: 'emoji', fontKeys: ['emoji'], fontSize: 32, language: 'und' },
      }),
      new Map([['emoji', font]]),
    )
    const resources = new ColrV0TextResources(64)
    const sources = new Map([['emoji', { font, bytes }]])
    const first = resources.expand(layout, sources, 0, 0xffffff)
    expect(first.layout.glyphs.length).toBeGreaterThan(layout.glyphs.length)
    expect(Object.keys(first.styleColors).length).toBeGreaterThan(1)
    expect(resources.resolutionCount).toBe(1)
    resources.expand(layout, sources, 0, 0xffffff)
    expect(resources.resolutionCount).toBe(1)
    resources.expand(layout, sources, 0, 0x112233)
    expect(resources.resolutionCount).toBe(2)

    resources.dispose()
    resources.dispose()
    expect(font.facts.coverageCount).toBeGreaterThan(0)
    font.dispose()
  })

  test('leaves the last accepted Text state intact when payload resolution fails', async () => {
    const bytes = await readFile(fixturePath)
    const font = await loadFont(bytes)
    const layout = layoutPreparedText(
      prepareText({
        text: '😀',
        style: { key: 'emoji', fontKeys: ['emoji'], fontSize: 32, language: 'und' },
      }),
      new Map([['emoji', font]]),
    )
    const resources = new ColrV0TextResources()
    const accepted = resources.expand(layout, new Map([['emoji', { font, bytes }]]))
    const text = new Text({ ...accepted, resources: resources.textResources })
    await text.sync()
    const previous = text.layoutResult

    expect(() =>
      resources.expand(
        layout,
        new Map([
          [
            'emoji',
            {
              font: { getOutline: font.getOutline.bind(font) },
              bytes: new Uint8Array(4),
            },
          ],
        ]),
      ),
    ).toThrow()
    expect(text.layoutResult).toBe(previous)

    text.dispose()
    resources.dispose()
    font.dispose()
  })
})

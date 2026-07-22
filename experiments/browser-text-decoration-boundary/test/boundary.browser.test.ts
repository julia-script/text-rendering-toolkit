import { loadFont } from '@webgpu-text/font'
import { layoutText } from '@webgpu-text/layout'
import { Text } from '@webgpu-text/three'
import { afterEach, describe, expect, test } from 'vitest'
import { commands, page } from 'vitest/browser'

import type { PaintRequest } from '../src/index.js'
import { createValidationHarness, VIEWPORT } from '../src/webgpu.js'

const emojiUrl = new URL(
  '../../../test-fixtures/fonts/color-glyph-validation/noto-validation-colr-v0.ttf',
  import.meta.url,
)
const disposers: Array<() => void> = []
const initial: PaintRequest = {
  outlineWidthPixels: 4,
  shadowOffsetXPixels: 2,
  shadowOffsetYPixels: -2,
  shadowSoftnessPixels: 3,
  fillColor: { red: 36, green: 99, blue: 235, alpha: 255 },
  outlineColor: { red: 250, green: 204, blue: 21, alpha: 255 },
  shadowColor: { red: 15, green: 23, blue: 42, alpha: 180 },
}

function semantics(image: ImageData) {
  let transparent = 0
  let semiTransparent = 0
  let cyan = 0
  let blue = 0
  let orange = 0
  let purple = 0
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const red = image.data[offset] ?? 0
    const green = image.data[offset + 1] ?? 0
    const valueBlue = image.data[offset + 2] ?? 0
    const alpha = image.data[offset + 3] ?? 0
    if (alpha === 0) transparent++
    if (alpha > 0 && alpha < 255) semiTransparent++
    if (valueBlue > red + 25 && valueBlue > green) blue++
    if (green > red + 25 && valueBlue > red + 25) cyan++
    if (red > valueBlue + 40 && green > valueBlue + 15) orange++
    if (red > green + 25 && valueBlue > green + 25) purple++
  }
  return { transparent, semiTransparent, cyan, blue, orange, purple }
}

afterEach(() => {
  while (disposers.length) disposers.pop()?.()
  document.body.replaceChildren()
})

describe('browser text decoration boundary on actual WebGPU', () => {
  test('renders neutral patterns and shared-SDF paint with atomic appearance updates', async () => {
    await page.viewport(VIEWPORT.width + 24, VIEWPORT.height + 24)
    const container = document.createElement('div')
    document.body.replaceChildren(container)
    const harness = await createValidationHarness(container, initial)
    disposers.push(harness.dispose)

    const emojiResponse = await fetch(emojiUrl)
    if (!emojiResponse.ok) throw new Error(`Unable to load color fixture: ${emojiResponse.status}`)
    const emoji = await loadFont(new Uint8Array(await emojiResponse.arrayBuffer()))
    const registry = new Map([['emoji', emoji]])
    const emojiText = new Text({
      layout: layoutText(
        {
          text: '😀',
          paragraphDirection: 'ltr',
          style: { key: 'emoji', fontKeys: ['emoji'], fontSize: 0.42, language: 'und' },
          layout: { anchorX: 'center', anchorY: 'middle' },
        },
        registry,
      ),
      fonts: registry,
    })
    emojiText.position.set(-0.08, -0.62, 0)
    await emojiText.sync()
    // Representative COLR content is rendered through the public path; the spike deliberately
    // does not apply glyph outline/shadow semantics to its layered silhouette.
    harness.add(emojiText)
    expect(emojiText.parent).not.toBeNull()

    await harness.render()
    const first = semantics(await harness.capture())
    const before = harness.snapshot()
    expect(first.transparent).toBeGreaterThan(VIEWPORT.width * VIEWPORT.height * 0.7)
    expect(first.cyan).toBeGreaterThan(20)
    expect(first.blue).toBeGreaterThan(100)
    expect(first.orange).toBeGreaterThan(20)
    expect(first.purple).toBeGreaterThan(20)

    harness.update({
      ...initial,
      fillColor: { red: 168, green: 85, blue: 247, alpha: 255 },
      outlineColor: { red: 34, green: 197, blue: 94, alpha: 255 },
    })
    await harness.render()
    const after = harness.snapshot()
    const updated = semantics(await harness.capture())
    expect(after.textureUuid).toBe(before.textureUuid)
    expect(after.borrowerCount).toBe(2)
    expect(updated.purple).toBeGreaterThan(first.purple)

    expect(() => harness.update({ ...initial, outlineWidthPixels: 8 })).toThrow(
      'requires 9px padding',
    )
    expect(harness.snapshot()).toEqual(after)

    await (
      commands as unknown as {
        recordDecorationObservation(observation: unknown): Promise<void>
      }
    ).recordDecorationObservation({
      schemaVersion: 1,
      kind: 'actual-webgpu-browser-text-decoration-boundary',
      browser: navigator.userAgent,
      platform: navigator.platform,
      adapter: harness.adapterInfo,
      backend: 'WebGPU',
      three: '0.185.1',
      viewport: VIEWPORT,
      decorationStyles: ['solid', 'dotted', 'wavy', 'strikethrough'],
      independentColors: ['explicit RGBA', 'current foreground'],
      materialVariants: harness.materialVariants,
      sharedSdf: {
        textureUuidBefore: before.textureUuid,
        textureUuidAfterAppearanceUpdate: after.textureUuid,
        borrowers: after.borrowerCount,
        dimensions: [after.textureWidth, after.textureHeight],
      },
      semanticPixels: { first, updated },
      excessivePaintRecovery: 'rejected before uniform mutation; last valid snapshot preserved',
      colrV0:
        'renderer-neutral decorations coexist; composed-silhouette outline/shadow deliberately deferred',
      lifecycle: 'owned meshes, materials, texture, and renderer dispose idempotently',
    })

    harness.remove(emojiText)
    emojiText.dispose()
    emojiText.dispose()
    emoji.dispose()
    emoji.dispose()
    harness.dispose()
    harness.dispose()
    disposers.pop()
  })
})

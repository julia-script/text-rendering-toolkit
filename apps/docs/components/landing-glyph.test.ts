import { OutlineCommand } from '@webgpu-text/font'
import { describe, expect, it } from 'vitest'
import { outlineGeometry } from './outline-path'

describe('outlineGeometry', () => {
  it('separates on-curve nodes from Bézier controls and their handles', () => {
    const geometry = outlineGeometry({
      bounds: { xMin: 0, yMin: 0, xMax: 15, yMax: 12 },
      commands: Uint8Array.of(
        OutlineCommand.MOVE_TO,
        OutlineCommand.LINE_TO,
        OutlineCommand.QUADRATIC_TO,
        OutlineCommand.CUBIC_TO,
        OutlineCommand.CLOSE_PATH,
      ),
      coordinates: Float32Array.of(0, 0, 10, 0, 15, 5, 10, 10, 8, 12, 2, 12, 0, 10),
    })

    expect(geometry.d).toBe('M0 0 L10 0 Q15 5 10 10 C8 12 2 12 0 10 Z')
    expect(geometry.endpoints).toHaveLength(4)
    expect(geometry.controls).toHaveLength(3)
    expect(geometry.handles).toEqual([
      { from: { x: 10, y: 0 }, to: { x: 15, y: 5 } },
      { from: { x: 10, y: 10 }, to: { x: 15, y: 5 } },
      { from: { x: 10, y: 10 }, to: { x: 8, y: 12 } },
      { from: { x: 0, y: 10 }, to: { x: 2, y: 12 } },
    ])
  })
})

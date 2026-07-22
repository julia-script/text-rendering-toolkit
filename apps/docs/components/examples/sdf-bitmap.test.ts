import { describe, expect, it } from 'vitest'
import { sdfPixelsToCoverageRgba, sdfPixelsToRgba } from './sdf-bitmap'

describe('sdfPixelsToRgba', () => {
  it('flips font-space rows into canvas order and expands grayscale values', () => {
    expect([...sdfPixelsToRgba(Uint8Array.of(1, 2, 3, 4), 2, 2)]).toEqual([
      3, 3, 3, 255, 4, 4, 4, 255, 1, 1, 1, 255, 2, 2, 2, 255,
    ])
  })

  it('turns the encoded midpoint into adjustable alpha coverage', () => {
    expect([...sdfPixelsToCoverageRgba(Uint8Array.of(0, 128, 255), 3, 1, 16)]).toEqual([
      85, 216, 255, 0, 85, 216, 255, 128, 85, 216, 255, 255,
    ])
  })
})

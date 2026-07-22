export function sdfPixelsToRgba(
  pixels: Uint8Array,
  width: number,
  height: number,
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = pixels[(height - y - 1) * width + x] ?? 0
      const offset = (y * width + x) * 4
      rgba[offset] = value
      rgba[offset + 1] = value
      rgba[offset + 2] = value
      rgba[offset + 3] = 255
    }
  }
  return rgba
}

export function sdfPixelsToCoverageRgba(
  pixels: Uint8Array,
  width: number,
  height: number,
  softness: number,
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = pixels[(height - y - 1) * width + x] ?? 0
      const coverage = Math.round(
        Math.max(0, Math.min(1, (value - (128 - softness)) / (softness * 2))) * 255,
      )
      const offset = (y * width + x) * 4
      rgba[offset] = 85
      rgba[offset + 1] = 216
      rgba[offset + 2] = 255
      rgba[offset + 3] = coverage
    }
  }
  return rgba
}

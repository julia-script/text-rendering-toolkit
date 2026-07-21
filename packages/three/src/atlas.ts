import type { SdfBitmap, SdfViewBox } from '@webgpu-text/sdf'
import { DataTexture, LinearFilter, NoColorSpace, RGBAFormat, UnsignedByteType } from 'three/webgpu'

export interface CachedGlyph {
  readonly slot: number | null
  readonly viewBox: SdfViewBox | null
}

export interface AtlasAddition {
  readonly key: string
  readonly bitmap: SdfBitmap | null
}

export interface AtlasPlan {
  readonly pixels: Uint8Array
  readonly gridSize: number
  readonly nextSlot: number
  readonly glyphs: Map<string, CachedGlyph>
  readonly dirty: boolean
}

function copyRows(
  source: Uint8Array,
  sourceWidth: number,
  target: Uint8Array,
  targetWidth: number,
): void {
  const rowBytes = sourceWidth * 4
  for (let y = 0; y < sourceWidth; y += 1) {
    target.set(source.subarray(y * rowBytes, (y + 1) * rowBytes), y * targetWidth * 4)
  }
}

function pack(
  target: Uint8Array,
  atlasWidth: number,
  cellSize: number,
  slot: number,
  bitmap: SdfBitmap,
): void {
  if (bitmap.width !== cellSize || bitmap.height !== cellSize) {
    throw new RangeError('SDF bitmap dimensions must equal the atlas cell size')
  }
  const channel = slot % 4
  const cell = Math.floor(slot / 4)
  const cellsPerRow = atlasWidth / cellSize
  const cellX = (cell % cellsPerRow) * cellSize
  const cellY = Math.floor(cell / cellsPerRow) * cellSize
  for (let y = 0; y < cellSize; y += 1) {
    for (let x = 0; x < cellSize; x += 1) {
      const targetOffset = ((cellY + y) * atlasWidth + cellX + x) * 4 + channel
      target[targetOffset] = bitmap.pixels[y * cellSize + x] ?? 0
    }
  }
}

export class RgbaGlyphAtlas {
  readonly cellSize: number
  readonly texture: DataTexture
  #pixels: Uint8Array
  #gridSize = 1
  #nextSlot = 0
  #glyphs = new Map<string, CachedGlyph>()
  #disposed = false

  constructor(cellSize: number) {
    this.cellSize = cellSize
    this.#pixels = new Uint8Array(cellSize * cellSize * 4)
    this.texture = new DataTexture(this.#pixels, cellSize, cellSize, RGBAFormat, UnsignedByteType)
    this.texture.colorSpace = NoColorSpace
    this.texture.generateMipmaps = false
    this.texture.minFilter = LinearFilter
    this.texture.magFilter = LinearFilter
    this.texture.unpackAlignment = 1
    this.texture.needsUpdate = true
  }

  get gridSize(): number {
    return this.#gridSize
  }

  get pixels(): Uint8Array {
    return this.#pixels
  }

  get size(): number {
    return this.#glyphs.size
  }

  lookup(key: string): CachedGlyph | undefined {
    return this.#glyphs.get(key)
  }

  plan(additions: readonly AtlasAddition[]): AtlasPlan {
    if (this.#disposed) throw new Error('Atlas has been disposed')
    const glyphs = new Map(this.#glyphs)
    const unique = new Map<string, SdfBitmap | null>()
    for (const addition of additions) {
      if (!glyphs.has(addition.key) && !unique.has(addition.key)) {
        unique.set(addition.key, addition.bitmap)
      }
    }
    if (unique.size === 0) {
      return {
        pixels: this.#pixels,
        gridSize: this.#gridSize,
        nextSlot: this.#nextSlot,
        glyphs: this.#glyphs,
        dirty: false,
      }
    }
    const drawable = [...unique.values()].filter((bitmap) => bitmap !== null).length
    let gridSize = this.#gridSize
    while (gridSize * gridSize * 4 < this.#nextSlot + drawable) gridSize *= 2
    const atlasWidth = gridSize * this.cellSize
    const pixels = new Uint8Array(atlasWidth * atlasWidth * 4)
    copyRows(this.#pixels, this.#gridSize * this.cellSize, pixels, atlasWidth)
    let nextSlot = this.#nextSlot
    for (const [key, bitmap] of unique) {
      if (bitmap === null) {
        glyphs.set(key, { slot: null, viewBox: null })
        continue
      }
      const slot = nextSlot++
      pack(pixels, atlasWidth, this.cellSize, slot, bitmap)
      glyphs.set(key, { slot, viewBox: bitmap.viewBox })
    }
    return {
      pixels,
      gridSize,
      nextSlot,
      glyphs,
      dirty: unique.size > 0,
    }
  }

  commit(plan: AtlasPlan): void {
    if (this.#disposed) throw new Error('Atlas has been disposed')
    if (!plan.dirty) return
    this.#pixels = plan.pixels
    this.#gridSize = plan.gridSize
    this.#nextSlot = plan.nextSlot
    this.#glyphs = plan.glyphs
    const size = plan.gridSize * this.cellSize
    this.texture.image = { data: plan.pixels, width: size, height: size }
    this.texture.needsUpdate = true
  }

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    this.texture.dispose()
    this.#pixels = new Uint8Array()
    this.#glyphs.clear()
  }
}

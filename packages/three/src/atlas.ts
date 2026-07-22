import type { SdfBitmap, SdfViewBox } from '@webgpu-text/sdf'
import { DataTexture, LinearFilter, NoColorSpace, RGBAFormat, UnsignedByteType } from 'three/webgpu'

/** A glyph's place in the atlas, or a record that it needs none. */
export interface CachedGlyph {
  /** Slot index, or `null` for a blank glyph that occupies no space. */
  readonly slot: number | null
  /** View box the SDF was generated with, for sizing the quad; `null` when blank. */
  readonly viewBox: SdfViewBox | null
}

/** One glyph queued for insertion; a `null` bitmap records a blank glyph. */
export interface AtlasAddition {
  readonly key: string
  readonly bitmap: SdfBitmap | null
}

/**
 * A prepared atlas update that has not been applied yet.
 *
 * Produced by {@link RgbaGlyphAtlas.plan} and applied by
 * {@link RgbaGlyphAtlas.commit}, so a caller can abandon it without having
 * touched live state.
 */
export interface AtlasPlan {
  /** Pixel buffer for the updated atlas; the existing one when nothing changed. */
  readonly pixels: Uint8Array
  /** Grid size in cells per side after this plan. */
  readonly gridSize: number
  /** Next free slot index after this plan. */
  readonly nextSlot: number
  /** Full glyph lookup table as it will be after commit. */
  readonly glyphs: Map<string, CachedGlyph>
  /** Whether anything actually changed; a clean plan commits as a no-op. */
  readonly dirty: boolean
}

/**
 * Copies occupied slots from a smaller atlas into a larger one during growth.
 *
 * Slot-by-slot rather than a straight buffer copy: a slot's cell position
 * depends on how many cells fit per row, so widening the atlas moves every cell
 * to a new offset. The channel index is preserved, since a slot's channel is a
 * function of its index alone.
 */
function copySlots(
  source: Uint8Array,
  sourceWidth: number,
  target: Uint8Array,
  targetWidth: number,
  cellSize: number,
  slotCount: number,
): void {
  const sourceCellsPerRow = sourceWidth / cellSize
  const targetCellsPerRow = targetWidth / cellSize
  for (let slot = 0; slot < slotCount; slot += 1) {
    const channel = slot % 4
    const cell = Math.floor(slot / 4)
    const sourceX = (cell % sourceCellsPerRow) * cellSize
    const sourceY = Math.floor(cell / sourceCellsPerRow) * cellSize
    const targetX = (cell % targetCellsPerRow) * cellSize
    const targetY = Math.floor(cell / targetCellsPerRow) * cellSize
    for (let y = 0; y < cellSize; y += 1) {
      for (let x = 0; x < cellSize; x += 1) {
        const sourceOffset = ((sourceY + y) * sourceWidth + sourceX + x) * 4 + channel
        const targetOffset = ((targetY + y) * targetWidth + targetX + x) * 4 + channel
        target[targetOffset] = source[sourceOffset] ?? 0
      }
    }
  }
}

/**
 * Writes one glyph's SDF into a single color channel of its cell.
 *
 * Four slots share each cell, one per RGBA channel — so an atlas of N cells
 * holds 4N glyphs, quartering the texture memory a one-glyph-per-cell layout
 * would need. `slot % 4` picks the channel and `slot / 4` the cell.
 */
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

/**
 * A growing RGBA texture holding one monochrome glyph SDF per color channel.
 *
 * Four glyphs share every cell (one per channel), and the grid doubles when it
 * runs out of slots, copying existing content forward. Growth is the only
 * eviction policy: entries are never removed.
 *
 * Updates go through {@link RgbaGlyphAtlas.plan} then
 * {@link RgbaGlyphAtlas.commit} so failures cannot leave a half-written atlas.
 */
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

  /**
   * Computes the atlas state that would result from adding these glyphs,
   * without mutating anything.
   *
   * Deduplicates against both the live table and the additions themselves,
   * doubling the grid until every new drawable glyph fits. When nothing is new
   * it returns a non-dirty plan referencing existing state, so a repeat sync
   * costs no allocation.
   */
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
    copySlots(
      this.#pixels,
      this.#gridSize * this.cellSize,
      pixels,
      atlasWidth,
      this.cellSize,
      this.#nextSlot,
    )
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

  /**
   * Applies a plan, swapping in its pixels and refreshing the texture.
   *
   * A non-dirty plan returns immediately.
   */
  commit(plan: AtlasPlan): void {
    if (this.#disposed) throw new Error('Atlas has been disposed')
    if (!plan.dirty) return
    const resized = plan.gridSize !== this.#gridSize
    this.#pixels = plan.pixels
    this.#gridSize = plan.gridSize
    this.#nextSlot = plan.nextSlot
    this.#glyphs = plan.glyphs
    const size = plan.gridSize * this.cellSize
    // Three retains backend texture storage by Texture identity. Releasing that
    // storage before a resize lets WebGPU allocate the new dimensions while
    // materials keep referencing this same DataTexture object.
    if (resized) this.texture.dispose()
    this.texture.image = { data: plan.pixels, width: size, height: size }
    this.texture.needsUpdate = true
  }

  /** Releases the texture and cached pixels. Idempotent. */
  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    this.texture.dispose()
    this.#pixels = new Uint8Array()
    this.#glyphs.clear()
  }
}

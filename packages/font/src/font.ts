import {
  DisposedFontHandleError,
  InvalidFontError,
  InvalidFontInputError,
  InvalidShapingInputError,
} from './errors.js'
import { copyAndClassifyFont } from './input.js'
import { ColorLayerReader } from './internal/color.js'
import {
  HarfBuzzBlob,
  HarfBuzzBuffer,
  HarfBuzzFace,
  HarfBuzzFont,
  type HarfBuzzGlyph,
  type HarfBuzzGlyphExtents,
} from './internal/harfbuzz.js'
import {
  type ColorGlyphLayer,
  type FontFacts,
  type FontHandle,
  type FontSource,
  type GlyphBounds,
  type GlyphOutline,
  OutlineCommand,
  type ShapedRun,
  type ShapeInput,
  type TextDirection,
  type VariationAxis,
  type VariationCoordinates,
} from './types.js'

const directionValues: Readonly<Record<TextDirection, number>> = {
  ltr: 4,
  rtl: 5,
  ttb: 6,
  btt: 7,
}

const EMPTY_VARIATIONS: VariationCoordinates = Object.freeze({})
const ZERO_BOUNDS: GlyphBounds = Object.freeze({ xMin: 0, yMin: 0, xMax: 0, yMax: 0 })

function validCodePoint(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 0x10ffff &&
    !(value >= 0xd800 && value <= 0xdfff)
  )
}

function normalizeFeatures(features: readonly string[] | undefined): readonly string[] {
  if (features === undefined) return []
  if (!Array.isArray(features)) throw new InvalidShapingInputError('features must be an array')
  return features.map((feature) => {
    if (typeof feature !== 'string' || feature.length === 0 || /[^\x20-\x7e]/.test(feature)) {
      throw new InvalidShapingInputError('OpenType features must be non-empty ASCII strings')
    }
    return feature
  })
}

function normalizeVariations(
  variations: VariationCoordinates | undefined,
  axes: ReadonlyMap<string, VariationAxis>,
): VariationCoordinates {
  if (variations === undefined) return EMPTY_VARIATIONS
  if (typeof variations !== 'object' || variations === null || Array.isArray(variations)) {
    throw new InvalidShapingInputError('variations must be a record of axis tags to numbers')
  }

  const entries = Object.entries(variations)
    .map(([tag, value]) => {
      if (!/^[\x20-\x7e]{4}$/.test(tag)) {
        throw new InvalidShapingInputError(`Invalid variation axis tag: ${tag}`)
      }
      const axis = axes.get(tag)
      if (!axis) throw new InvalidShapingInputError(`Font does not define variation axis: ${tag}`)
      if (!Number.isFinite(value)) {
        throw new InvalidShapingInputError(`Variation value for ${tag} must be finite`)
      }
      return [
        tag,
        Math.min(axis.max, Math.max(axis.min, Object.is(value, -0) ? 0 : value)),
      ] as const
    })
    .sort(([left], [right]) => left.localeCompare(right))
  return Object.freeze(Object.fromEntries(entries))
}

function validateShapeInput(input: ShapeInput): void {
  if (typeof input !== 'object' || input === null) {
    throw new InvalidShapingInputError('shape input must be an object')
  }
  if (typeof input.text !== 'string') throw new InvalidShapingInputError('text must be a string')
  if (!Object.hasOwn(directionValues, input.direction)) {
    throw new InvalidShapingInputError(`Unsupported direction: ${String(input.direction)}`)
  }
  if (!/^[A-Za-z]{4}$/.test(input.script)) {
    throw new InvalidShapingInputError('script must be a four-letter ISO 15924 code')
  }
  if (!/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(input.language)) {
    throw new InvalidShapingInputError('language must be a non-empty ASCII language tag')
  }
}

function clusterEnds(text: string, clusters: readonly number[]): ReadonlyMap<number, number> {
  const starts = [...new Set(clusters)].sort((left, right) => left - right)
  const ends = new Map<number, number>()
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index]
    if (start === undefined || start < 0 || start >= text.length) {
      throw new InvalidFontError('HarfBuzz returned an invalid UTF-16 cluster')
    }
    if (
      start > 0 &&
      /[\uDC00-\uDFFF]/.test(text[start] ?? '') &&
      /[\uD800-\uDBFF]/.test(text[start - 1] ?? '')
    ) {
      throw new InvalidFontError('HarfBuzz returned a cluster that splits a surrogate pair')
    }
    ends.set(start, starts[index + 1] ?? text.length)
  }
  return ends
}

function variationKey(variations: VariationCoordinates): string {
  return Object.entries(variations)
    .map(([tag, value]) => `${tag}=${value}`)
    .join(',')
}

function outlineBounds(
  extents: HarfBuzzGlyphExtents | undefined,
  coordinates: readonly number[],
): GlyphBounds {
  let xMin = extents?.xBearing ?? Number.POSITIVE_INFINITY
  let xMax = extents ? extents.xBearing + extents.width : Number.NEGATIVE_INFINITY
  let yMax = extents?.yBearing ?? Number.NEGATIVE_INFINITY
  let yMin = extents ? extents.yBearing + extents.height : Number.POSITIVE_INFINITY
  if (xMin > xMax) [xMin, xMax] = [xMax, xMin]
  if (yMin > yMax) [yMin, yMax] = [yMax, yMin]

  for (let index = 0; index < coordinates.length; index += 2) {
    const x = coordinates[index]
    const y = coordinates[index + 1]
    if (x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y)) {
      throw new InvalidFontError('HarfBuzz returned a non-finite outline coordinate')
    }
    xMin = Math.min(xMin, x)
    xMax = Math.max(xMax, x)
    yMin = Math.min(yMin, y)
    yMax = Math.max(yMax, y)
  }
  if (![xMin, yMin, xMax, yMax].every(Number.isFinite)) return ZERO_BOUNDS
  return Object.freeze({ xMin, yMin, xMax, yMax })
}

class FontHandleImplementation implements FontHandle {
  readonly #blob: HarfBuzzBlob
  readonly #face: HarfBuzzFace
  readonly #font: HarfBuzzFont
  readonly #buffer: HarfBuzzBuffer
  readonly #facts: FontFacts
  readonly #colorLayers: ColorLayerReader
  readonly #axes: ReadonlyMap<string, VariationAxis>
  readonly #outlineCache = new Map<string, GlyphOutline>()
  #disposed = false

  constructor(
    blob: HarfBuzzBlob,
    face: HarfBuzzFace,
    font: HarfBuzzFont,
    buffer: HarfBuzzBuffer,
    facts: FontFacts,
    bytes: ArrayBuffer,
  ) {
    this.#blob = blob
    this.#face = face
    this.#font = font
    this.#buffer = buffer
    this.#facts = facts
    this.#colorLayers = new ColorLayerReader(bytes)
    this.#axes = new Map(facts.axes.map((axis) => [axis.tag, axis]))
  }

  get facts(): FontFacts {
    this.#assertLive()
    return this.#facts
  }

  supports(codePoint: number): boolean {
    this.#assertLive()
    if (!validCodePoint(codePoint))
      throw new InvalidFontInputError('codePoint must be a Unicode scalar value')
    return this.#font.nominalGlyph(codePoint) !== undefined
  }

  shape(input: ShapeInput): ShapedRun {
    this.#assertLive()
    validateShapeInput(input)
    const variations = normalizeVariations(input.variations, this.#axes)
    const features = normalizeFeatures(input.features)
    this.#font.setVariations(variations)

    let glyphs: readonly HarfBuzzGlyph[]
    try {
      glyphs = this.#buffer.shape(
        this.#font,
        input.text,
        directionValues[input.direction],
        input.script,
        input.language,
        features,
      )
    } catch (error) {
      if (error instanceof TypeError) throw new InvalidShapingInputError(error.message)
      throw error
    }
    const ends = clusterEnds(
      input.text,
      glyphs.map((glyph) => glyph.cluster),
    )
    return {
      textLengthUtf16: input.text.length,
      direction: input.direction,
      script: input.script,
      language: input.language,
      variations,
      glyphs: glyphs.map((glyph) => {
        const clusterEnd = ends.get(glyph.cluster)
        if (clusterEnd === undefined) throw new InvalidFontError('Missing UTF-16 cluster boundary')
        return {
          glyphId: glyph.glyphId,
          clusterStart: glyph.cluster,
          clusterEnd,
          sourceText: input.text.slice(glyph.cluster, clusterEnd),
          xAdvance: glyph.xAdvance,
          yAdvance: glyph.yAdvance,
          xOffset: glyph.xOffset,
          yOffset: glyph.yOffset,
          flags: glyph.flags,
        }
      }),
    }
  }

  getOutline(glyphId: number, requestedVariations?: VariationCoordinates): GlyphOutline {
    this.#assertLive()
    if (!Number.isInteger(glyphId) || glyphId < 0 || glyphId > 0xffffffff) {
      throw new InvalidFontInputError('glyphId must be an unsigned 32-bit integer')
    }
    const variations = normalizeVariations(requestedVariations, this.#axes)
    const key = `${glyphId}|${variationKey(variations)}`
    const cached = this.#outlineCache.get(key)
    if (cached) return cached

    this.#font.setVariations(variations)
    const commands: number[] = []
    const coordinates: number[] = []
    this.#font.drawGlyph(glyphId, {
      moveTo(x, y) {
        commands.push(OutlineCommand.MOVE_TO)
        coordinates.push(x, y)
      },
      lineTo(x, y) {
        commands.push(OutlineCommand.LINE_TO)
        coordinates.push(x, y)
      },
      quadraticTo(controlX, controlY, x, y) {
        commands.push(OutlineCommand.QUADRATIC_TO)
        coordinates.push(controlX, controlY, x, y)
      },
      cubicTo(control1X, control1Y, control2X, control2Y, x, y) {
        commands.push(OutlineCommand.CUBIC_TO)
        coordinates.push(control1X, control1Y, control2X, control2Y, x, y)
      },
      closePath() {
        commands.push(OutlineCommand.CLOSE_PATH)
      },
    })

    const outline: GlyphOutline = Object.freeze({
      commands: Uint8Array.from(commands),
      coordinates: Float32Array.from(coordinates),
      bounds:
        commands.length === 0
          ? ZERO_BOUNDS
          : outlineBounds(this.#font.glyphExtents(glyphId), coordinates),
    })
    this.#outlineCache.set(key, outline)
    return outline
  }

  getColorLayers(glyphId: number): readonly ColorGlyphLayer[] | null {
    this.#assertLive()
    if (!Number.isInteger(glyphId) || glyphId < 0 || glyphId > 0xffffffff) {
      throw new InvalidFontInputError('glyphId must be an unsigned 32-bit integer')
    }
    return this.#colorLayers.get(glyphId)
  }

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    this.#outlineCache.clear()
    this.#colorLayers.dispose()
    this.#buffer.destroy()
    this.#font.destroy()
    this.#face.destroy()
    this.#blob.destroy()
  }

  #assertLive(): void {
    if (this.#disposed) throw new DisposedFontHandleError()
  }
}

export async function loadFont(source: FontSource): Promise<FontHandle> {
  const { bytes } = copyAndClassifyFont(source)
  let blob: HarfBuzzBlob | undefined
  let face: HarfBuzzFace | undefined
  let font: HarfBuzzFont | undefined
  let buffer: HarfBuzzBuffer | undefined
  try {
    blob = new HarfBuzzBlob(bytes)
    face = new HarfBuzzFace(blob)
    font = new HarfBuzzFont(face)
    const coverageCount = face.coverageCount()
    if (face.upem <= 0 || coverageCount === 0) throw new InvalidFontError()

    font.setScale(face.upem, face.upem)
    const extents = font.horizontalExtents()
    const axes = Object.entries(face.axisInfos())
      .map(([tag, axis]) => Object.freeze({ tag, ...axis }))
      .sort((left, right) => left.tag.localeCompare(right.tag))
    const facts: FontFacts = Object.freeze({
      unitsPerEm: face.upem,
      ascender: extents.ascender,
      descender: extents.descender,
      lineGap: extents.lineGap,
      coverageCount,
      axes: Object.freeze(axes),
    })
    buffer = new HarfBuzzBuffer()
    return new FontHandleImplementation(blob, face, font, buffer, facts, bytes)
  } catch (error) {
    buffer?.destroy()
    font?.destroy()
    face?.destroy()
    blob?.destroy()
    if (error instanceof InvalidFontError) throw error
    throw new InvalidFontError()
  }
}

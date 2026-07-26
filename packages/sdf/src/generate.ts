/**
 * CPU SDF behavior adapted from webgl-sdf-generator 1.1.1.
 * Copyright (c) 2021 Jason Johnston, MIT License.
 * See ../THIRD_PARTY_NOTICES.md and ../LICENSE.webgl-sdf-generator.txt.
 */
import { InvalidSdfInputError } from './errors.js'
import type { GenerateSdfInput, SdfBitmap, SdfOutline } from './types.js'
import { SdfCommand } from './types.js'

/** Operands consumed by each {@link SdfCommand}, indexed by opcode. */
const COORDINATE_COUNTS = [2, 2, 4, 6, 0] as const

/**
 * Points per flattened curve. Pinned: changing it changes every generated
 * byte, so golden fixtures must be regenerated alongside it.
 */
const CURVE_POINTS = 16

/** Allocation ceiling for `width * height`, guarding against absurd rasters. */
const MAX_PIXELS = 0x7fffffff

/**
 * One flattened line segment with its cached bounding box.
 *
 * The bounds are precomputed because the distance and winding loops test them
 * per texel; `ordinal` preserves original emission order so sorting stays
 * stable and output deterministic.
 */
interface Segment {
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
  /** Emission index, used only as a stable tiebreaker when sorting. */
  readonly ordinal: number
}

function fail(message: string, cause?: unknown): never {
  throw new InvalidSdfInputError(message, cause === undefined ? undefined : { cause })
}

/**
 * Copies the caller's input into a plain object before anything is validated.
 *
 * Every field is read exactly once, so a getter or `Proxy` trap cannot return
 * one value to the validator and another to the sampling loop — which would
 * otherwise emit a raster sized by a value that was never checked. Failures
 * during the read are reported as invalid input rather than escaping as the
 * caller's own error.
 */
function snapshotInput(input: GenerateSdfInput): GenerateSdfInput {
  if (typeof input !== 'object' || input === null) {
    fail('input must be an object')
  }
  let snapshot: GenerateSdfInput
  try {
    const { outline, viewBox, width, height, distance, exponent } = input
    snapshot = { outline, viewBox, width, height, distance, exponent }
  } catch (error) {
    fail('input properties could not be read', error)
  }
  if (typeof snapshot.outline !== 'object' || snapshot.outline === null) {
    fail('outline must be an object')
  }
  if (typeof snapshot.viewBox !== 'object' || snapshot.viewBox === null) {
    fail('viewBox must be an object')
  }
  try {
    const { commands, coordinates } = snapshot.outline
    const { left, bottom, right, top } = snapshot.viewBox
    return {
      ...snapshot,
      outline: { commands, coordinates },
      viewBox: { left, bottom, right, top },
    }
  } catch (error) {
    fail('input properties could not be read', error)
  }
}

function positiveFinite(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) fail(`${field} must be finite and greater than zero`)
}

/**
 * Walks the command stream checking opcodes, contour state, and coordinate
 * supply.
 *
 * Tracks `contourOpen` so a draw before its `MOVE_TO` or a stray `CLOSE_PATH`
 * is rejected, and requires the coordinate array to be consumed exactly —
 * leftover values signal a caller mismatch worth surfacing rather than ignoring.
 */
function validateOutline(outline: SdfOutline): void {
  if (!(outline.commands instanceof Uint8Array)) fail('outline.commands must be a Uint8Array')
  if (!(outline.coordinates instanceof Float32Array)) {
    fail('outline.coordinates must be a Float32Array')
  }

  let coordinateIndex = 0
  let contourOpen = false
  for (let commandIndex = 0; commandIndex < outline.commands.length; commandIndex++) {
    const command = outline.commands[commandIndex] as number
    const coordinateCount = COORDINATE_COUNTS[command]
    if (coordinateCount === undefined) fail(`outline.commands[${commandIndex}] is unknown`)
    if (command !== SdfCommand.MOVE_TO && command !== SdfCommand.CLOSE_PATH && !contourOpen) {
      fail(`outline.commands[${commandIndex}] draws before a move`)
    }
    if (command === SdfCommand.CLOSE_PATH && !contourOpen) {
      fail(`outline.commands[${commandIndex}] closes without an open contour`)
    }
    if (coordinateIndex + coordinateCount > outline.coordinates.length) {
      fail(`outline.coordinates is too short for command ${commandIndex}`)
    }
    for (let index = 0; index < coordinateCount; index++) {
      if (!Number.isFinite(outline.coordinates[coordinateIndex + index])) {
        fail(`outline.coordinates[${coordinateIndex + index}] must be finite`)
      }
    }
    coordinateIndex += coordinateCount
    if (command === SdfCommand.MOVE_TO) contourOpen = true
    if (command === SdfCommand.CLOSE_PATH) contourOpen = false
  }
  if (coordinateIndex !== outline.coordinates.length) {
    fail(`outline.coordinates has ${outline.coordinates.length - coordinateIndex} unused values`)
  }
}

/**
 * Validates the whole request before anything is allocated.
 *
 * @returns The pixel count, so the caller allocates from an already-checked value.
 */
function validateInput(input: GenerateSdfInput): number {
  for (const field of ['width', 'height'] as const) {
    if (!Number.isSafeInteger(input[field]) || input[field] <= 0) {
      fail(`${field} must be a positive safe integer`)
    }
  }
  const pixelCount = input.width * input.height
  if (!Number.isSafeInteger(pixelCount) || pixelCount > MAX_PIXELS) {
    fail('width * height exceeds the safe allocation limit')
  }
  for (const field of ['left', 'bottom', 'right', 'top'] as const) {
    if (!Number.isFinite(input.viewBox[field])) fail(`viewBox.${field} must be finite`)
  }
  if (input.viewBox.left >= input.viewBox.right) fail('viewBox must have positive width')
  if (input.viewBox.bottom >= input.viewBox.top) fail('viewBox must have positive height')
  positiveFinite(input.distance, 'distance')
  positiveFinite(input.exponent, 'exponent')
  validateOutline(input.outline)
  return pixelCount
}

/** Evaluates a quadratic Bézier at `t` in `0`–`1`. */
function quadratic(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t: number,
): readonly [number, number] {
  const inverse = 1 - t
  return [
    inverse * inverse * x0 + 2 * inverse * t * x1 + t * t * x2,
    inverse * inverse * y0 + 2 * inverse * t * y1 + t * t * y2,
  ]
}

/** Evaluates a cubic Bézier at `t` in `0`–`1`. */
function cubic(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  t: number,
): readonly [number, number] {
  const inverse = 1 - t
  return [
    inverse ** 3 * x0 + 3 * inverse * inverse * t * x1 + 3 * inverse * t * t * x2 + t ** 3 * x3,
    inverse ** 3 * y0 + 3 * inverse * inverse * t * y1 + 3 * inverse * t * t * y2 + t ** 3 * y3,
  ]
}

/**
 * Converts the command stream into line segments, subdividing curves at a fixed
 * {@link CURVE_POINTS} resolution.
 *
 * Zero-length segments are dropped so they cannot skew winding counts. An
 * unclosed contour is left open rather than implicitly closed, which is what
 * lets an open path act as a stroke-like distance source.
 *
 * The result is sorted by `maxX` — not cosmetic, but the precondition for the
 * early-exit scans in {@link isInside} and {@link signedDistance}, which walk
 * from the end and stop once no remaining segment can be relevant.
 */
function flatten(outline: SdfOutline): Segment[] {
  const segments: Segment[] = []
  const coordinates = outline.coordinates
  let coordinateIndex = 0
  let currentX = 0
  let currentY = 0
  let firstX = 0
  let firstY = 0

  const add = (x1: number, y1: number, x2: number, y2: number): void => {
    if (x1 === x2 && y1 === y2) return
    segments.push({
      x1,
      y1,
      x2,
      y2,
      minX: Math.min(x1, x2),
      minY: Math.min(y1, y2),
      maxX: Math.max(x1, x2),
      maxY: Math.max(y1, y2),
      ordinal: segments.length,
    })
  }

  for (const command of outline.commands) {
    if (command === SdfCommand.MOVE_TO) {
      currentX = firstX = coordinates[coordinateIndex] as number
      currentY = firstY = coordinates[coordinateIndex + 1] as number
      coordinateIndex += 2
    } else if (command === SdfCommand.LINE_TO) {
      const endX = coordinates[coordinateIndex] as number
      const endY = coordinates[coordinateIndex + 1] as number
      add(currentX, currentY, endX, endY)
      currentX = endX
      currentY = endY
      coordinateIndex += 2
    } else if (command === SdfCommand.QUADRATIC_TO) {
      const controlX = coordinates[coordinateIndex] as number
      const controlY = coordinates[coordinateIndex + 1] as number
      const endX = coordinates[coordinateIndex + 2] as number
      const endY = coordinates[coordinateIndex + 3] as number
      let previousX = currentX
      let previousY = currentY
      for (let index = 1; index < CURVE_POINTS; index++) {
        const [x, y] = quadratic(
          currentX,
          currentY,
          controlX,
          controlY,
          endX,
          endY,
          index / (CURVE_POINTS - 1),
        )
        add(previousX, previousY, x, y)
        previousX = x
        previousY = y
      }
      currentX = endX
      currentY = endY
      coordinateIndex += 4
    } else if (command === SdfCommand.CUBIC_TO) {
      const control1X = coordinates[coordinateIndex] as number
      const control1Y = coordinates[coordinateIndex + 1] as number
      const control2X = coordinates[coordinateIndex + 2] as number
      const control2Y = coordinates[coordinateIndex + 3] as number
      const endX = coordinates[coordinateIndex + 4] as number
      const endY = coordinates[coordinateIndex + 5] as number
      let previousX = currentX
      let previousY = currentY
      for (let index = 1; index < CURVE_POINTS; index++) {
        const [x, y] = cubic(
          currentX,
          currentY,
          control1X,
          control1Y,
          control2X,
          control2Y,
          endX,
          endY,
          index / (CURVE_POINTS - 1),
        )
        add(previousX, previousY, x, y)
        previousX = x
        previousY = y
      }
      currentX = endX
      currentY = endY
      coordinateIndex += 6
    } else if (command === SdfCommand.CLOSE_PATH) {
      add(currentX, currentY, firstX, firstY)
      currentX = firstX
      currentY = firstY
    }
  }

  return segments.sort((left, right) => left.maxX - right.maxX || left.ordinal - right.ordinal)
}

/**
 * Squared distance from a point to a segment, clamping the projection to the
 * segment's ends.
 *
 * Squared to keep the inner loop free of `Math.sqrt`; the root is taken only
 * when a new closest segment is found.
 */
function squareDistanceToSegment(x: number, y: number, segment: Segment): number {
  const dx = segment.x2 - segment.x1
  const dy = segment.y2 - segment.y1
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared
    ? Math.max(0, Math.min(1, ((x - segment.x1) * dx + (y - segment.y1) * dy) / lengthSquared))
    : 0
  const nearestX = segment.x1 + t * dx
  const nearestY = segment.y1 + t * dy
  return (x - nearestX) ** 2 + (y - nearestY) ** 2
}

/**
 * Non-zero winding test: casts a ray in +x and sums crossing directions.
 *
 * Non-zero rather than even-odd is what makes a reversed inner contour cut a
 * hole while a same-wound one merges. Segments are sorted by `maxX`, so the
 * reverse scan can stop as soon as one ends at or left of the sample point.
 */
function isInside(x: number, y: number, segments: readonly Segment[]): boolean {
  let winding = 0
  for (let index = segments.length - 1; index >= 0; index--) {
    const segment = segments[index] as Segment
    if (segment.maxX <= x) break
    const crosses =
      segment.y1 > y !== segment.y2 > y &&
      x < ((segment.x2 - segment.x1) * (y - segment.y1)) / (segment.y2 - segment.y1) + segment.x1
    if (crosses) winding += segment.y1 < segment.y2 ? 1 : -1
  }
  return winding !== 0
}

/**
 * Distance to the nearest segment, negated when the point is inside.
 *
 * The scan runs backwards over the `maxX`-sorted segments and prunes twice: it
 * exits once even the best remaining segment cannot beat the current closest,
 * and skips any whose bounding box, expanded by that closest distance, misses
 * the sample. Both bounds tighten as better candidates are found, which is what
 * keeps this affordable per texel.
 */
function signedDistance(x: number, y: number, segments: readonly Segment[]): number {
  let closestSquared = Number.POSITIVE_INFINITY
  let closest = Number.POSITIVE_INFINITY
  for (let index = segments.length - 1; index >= 0; index--) {
    const segment = segments[index] as Segment
    if (segment.maxX + closest <= x) break
    if (x + closest > segment.minX && y - closest < segment.maxY && y + closest > segment.minY) {
      const squared = squareDistanceToSegment(x, y, segment)
      if (squared < closestSquared) {
        closestSquared = squared
        closest = Math.sqrt(squared)
      }
    }
  }
  return isInside(x, y, segments) ? -closest : closest
}

/**
 * Maps a signed distance to a coverage byte.
 *
 * The magnitude falls from `0.5` at the edge to `0` at `maximum`, then inside
 * points are mirrored to `1 - magnitude`. That puts the edge at `0.5` — byte
 * 128 — with inside above and outside below, and saturates both directions
 * beyond `maximum`.
 */
function encode(distance: number, maximum: number, exponent: number): number {
  const magnitude = Math.max(0, 1 - Math.abs(distance) / maximum) ** exponent / 2
  const alpha = distance < 0 ? 1 - magnitude : magnitude
  return Math.max(0, Math.min(255, Math.round(alpha * 255)))
}

/**
 * Rasterizes vector geometry into a single-channel signed distance field.
 *
 * @remarks
 * Pure and synchronous: it allocates a new bitmap, never mutates or retains the
 * input arrays, and touches no global or browser state. Cost scales with
 * `width * height` times the flattened segment count, so generating a whole
 * sheet of glyphs is worth moving off the main thread — this package
 * deliberately provides no scheduling of its own.
 *
 * Curves are flattened deterministically to line segments before sampling, so
 * the same input always yields byte-identical output. Contours combine under
 * the non-zero winding rule, which makes a reversed inner contour a hole.
 *
 * Each texel is sampled at its center and encoded so that **values above 128
 * are inside** the shape and below 128 are outside; see {@link SdfBitmap} for
 * the full encoding and row-order contract. Empty or fully degenerate geometry
 * returns an all-zero bitmap rather than failing.
 *
 * All input is validated before the raster is allocated, so a bad request fails
 * fast without doing the expensive work.
 *
 * @param request - Geometry, sampling region, raster size, and encoding
 *   parameters.
 * @returns A newly allocated bitmap carrying its own decoding parameters.
 * @throws {@link InvalidSdfInputError} for a request that is not an object or
 *   whose `outline` or `viewBox` is not an object, a non-positive or
 *   non-integer `width`/`height`, an allocation exceeding the safe pixel limit,
 *   a zero-area or inverted `viewBox`, a non-positive `distance` or `exponent`,
 *   wrong typed-array types, an unknown opcode, a draw before a `MOVE_TO`, a
 *   `CLOSE_PATH` with no open contour, non-finite coordinates, or a coordinate
 *   array that is too short or has unused trailing values. Also thrown when a
 *   property cannot be read at all — a throwing getter or `Proxy` trap — with
 *   the original failure attached as `cause`.
 *
 * @example
 * A centered square sampled into a 5×5 field, with a linear ramp.
 * ```typescript
 * const bitmap = generateSdf({
 *   outline: {
 *     commands: Uint8Array.from([
 *       SdfCommand.MOVE_TO,
 *       SdfCommand.LINE_TO,
 *       SdfCommand.LINE_TO,
 *       SdfCommand.LINE_TO,
 *       SdfCommand.CLOSE_PATH,
 *     ]),
 *     coordinates: Float32Array.from([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5]),
 *   },
 *   viewBox: { left: -1, bottom: -1, right: 1, top: 1 },
 *   width: 5,
 *   height: 5,
 *   distance: 1,
 *   exponent: 1,
 * })
 * bitmap.pixels[2 * 5 + 2] // 191 — the center texel, inside (> 128)
 * bitmap.pixels[0] // 73 — the bottom-left corner, outside (< 128)
 * ```
 *
 * @example
 * Rasterize a glyph outline, padding the view box so the ramp is not clipped.
 * ```typescript
 * const outline = font.getOutline(glyphId, variations)
 * const padding = 8
 * const bitmap = generateSdf({
 *   outline,
 *   viewBox: {
 *     left: outline.bounds.xMin - padding,
 *     bottom: outline.bounds.yMin - padding,
 *     right: outline.bounds.xMax + padding,
 *     top: outline.bounds.yMax + padding,
 *   },
 *   width: 64,
 *   height: 64,
 *   distance: padding,
 *   exponent: 9,
 * })
 * ```
 */
export function generateSdf(request: GenerateSdfInput): SdfBitmap {
  const input = snapshotInput(request)
  const pixelCount = validateInput(input)
  const segments = flatten(input.outline)
  const pixels = new Uint8Array(pixelCount)
  if (segments.length > 0) {
    const viewBoxWidth = input.viewBox.right - input.viewBox.left
    const viewBoxHeight = input.viewBox.top - input.viewBox.bottom
    for (let x = 0; x < input.width; x++) {
      for (let y = 0; y < input.height; y++) {
        const sampleX = input.viewBox.left + (viewBoxWidth * (x + 0.5)) / input.width
        const sampleY = input.viewBox.bottom + (viewBoxHeight * (y + 0.5)) / input.height
        pixels[y * input.width + x] = encode(
          signedDistance(sampleX, sampleY, segments),
          input.distance,
          input.exponent,
        )
      }
    }
  }
  return {
    pixels,
    width: input.width,
    height: input.height,
    viewBox: { ...input.viewBox },
    distance: input.distance,
    exponent: input.exponent,
  }
}

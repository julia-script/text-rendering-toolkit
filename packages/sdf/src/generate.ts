/**
 * CPU SDF behavior adapted from webgl-sdf-generator 1.1.1.
 * Copyright (c) 2021 Jason Johnston, MIT License.
 * See ../THIRD_PARTY_NOTICES.md and ../LICENSE.webgl-sdf-generator.txt.
 */
import { InvalidSdfInputError } from './errors.js'
import type { GenerateSdfInput, SdfBitmap, SdfOutline } from './types.js'
import { SdfCommand } from './types.js'

const COORDINATE_COUNTS = [2, 2, 4, 6, 0] as const
const CURVE_POINTS = 16
const MAX_PIXELS = 0x7fffffff

interface Segment {
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
  readonly ordinal: number
}

function fail(message: string): never {
  throw new InvalidSdfInputError(message)
}

function positiveFinite(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) fail(`${field} must be finite and greater than zero`)
}

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

function encode(distance: number, maximum: number, exponent: number): number {
  const magnitude = Math.max(0, 1 - Math.abs(distance) / maximum) ** exponent / 2
  const alpha = distance < 0 ? 1 - magnitude : magnitude
  return Math.max(0, Math.min(255, Math.round(alpha * 255)))
}

export function generateSdf(input: GenerateSdfInput): SdfBitmap {
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

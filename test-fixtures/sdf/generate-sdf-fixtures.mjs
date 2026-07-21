/**
 * Reference fixture generator adapted from webgl-sdf-generator 1.1.1.
 * Copyright (c) 2021 Jason Johnston, MIT License.
 */
import { writeFile } from 'node:fs/promises'

const output = new URL('fixtures.json', import.meta.url)
const M = 0
const L = 1
const Q = 2
const C = 3
const Z = 4
const curvePoints = 16

const rectangle = (left, bottom, right, top, clockwise = false) => ({
  commands: [M, L, L, L, Z],
  coordinates: clockwise
    ? [left, bottom, left, top, right, top, right, bottom]
    : [left, bottom, right, bottom, right, top, left, top],
})

const cases = [
  {
    id: 'open-line-distance',
    intent: 'Pins unsigned distance around an open horizontal line.',
    outline: { commands: [M, L], coordinates: [-0.75, 0, 0.75, 0] },
    viewBox: { left: -1, bottom: -1, right: 1, top: 1 },
    width: 5,
    height: 5,
    distance: 1,
    exponent: 1,
  },
  {
    id: 'quadratic-closed',
    intent: 'Pins fixed quadratic flattening and a closed curved contour.',
    outline: { commands: [M, Q, Z], coordinates: [-0.8, -0.6, 0, 1, 0.8, -0.6] },
    viewBox: { left: -1, bottom: -1, right: 1, top: 1 },
    width: 7,
    height: 7,
    distance: 0.8,
    exponent: 1,
  },
  {
    id: 'cubic-closed',
    intent: 'Pins fixed cubic flattening and endpoint preservation.',
    outline: {
      commands: [M, C, L, Z],
      coordinates: [-0.8, -0.7, -0.8, 0.9, 0.8, 0.9, 0.8, -0.7, -0.8, -0.7],
    },
    viewBox: { left: -1, bottom: -1, right: 1, top: 1 },
    width: 7,
    height: 7,
    distance: 0.75,
    exponent: 1,
  },
  {
    id: 'asymmetric-orientation',
    intent: 'Makes bottom-row and row-major orientation observable.',
    outline: { commands: [M, L, L, Z], coordinates: [-0.9, -0.8, 0.8, -0.5, -0.5, 0.9] },
    viewBox: { left: -1, bottom: -1, right: 1, top: 1 },
    width: 4,
    height: 6,
    distance: 0.75,
    exponent: 1,
  },
  {
    id: 'multiple-contours-hole',
    intent: 'Pins non-zero winding with a reversed inner contour.',
    outline: {
      commands: [...rectangle(-0.9, -0.9, 0.9, 0.9).commands, ...rectangle(-0.4, -0.4, 0.4, 0.4, true).commands],
      coordinates: [...rectangle(-0.9, -0.9, 0.9, 0.9).coordinates, ...rectangle(-0.4, -0.4, 0.4, 0.4, true).coordinates],
    },
    viewBox: { left: -1, bottom: -1, right: 1, top: 1 },
    width: 7,
    height: 7,
    distance: 0.5,
    exponent: 1,
  },
  {
    id: 'padded-rectangle',
    intent: 'Pins explicit view-box padding around a simple contour.',
    outline: rectangle(-0.5, -0.5, 0.5, 0.5),
    viewBox: { left: -1.5, bottom: -1, right: 1.5, top: 1 },
    width: 6,
    height: 4,
    distance: 1,
    exponent: 1,
  },
  {
    id: 'clipped-contour',
    intent: 'Pins off-bitmap geometry contributions to distance and winding.',
    outline: rectangle(-2, -0.7, 0.35, 0.7),
    viewBox: { left: -1, bottom: -1, right: 1, top: 1 },
    width: 6,
    height: 6,
    distance: 0.75,
    exponent: 1,
  },
  {
    id: 'empty-outline',
    intent: 'Defines empty geometry as saturated outside pixels.',
    outline: { commands: [], coordinates: [] },
    viewBox: { left: -1, bottom: -1, right: 1, top: 1 },
    width: 3,
    height: 2,
    distance: 1,
    exponent: 1,
  },
  {
    id: 'degenerate-outline',
    intent: 'Defines zero-length geometry as saturated outside pixels.',
    outline: { commands: [M, L, Z], coordinates: [0, 0, 0, 0] },
    viewBox: { left: -1, bottom: -1, right: 1, top: 1 },
    width: 3,
    height: 3,
    distance: 1,
    exponent: 1,
  },
  {
    id: 'exponential-distance',
    intent: 'Pins exponential precision and saturation for exponent nine.',
    outline: rectangle(-0.5, -0.5, 0.5, 0.5),
    viewBox: { left: -1.5, bottom: -1.5, right: 1.5, top: 1.5 },
    width: 7,
    height: 7,
    distance: 1,
    exponent: 9,
  },
]

function flatten(outline) {
  const segments = []
  const coordinates = Float32Array.from(outline.coordinates)
  let coordinateIndex = 0
  let x = 0
  let y = 0
  let firstX = 0
  let firstY = 0
  const add = (x1, y1, x2, y2) => {
    if (x1 === x2 && y1 === y2) return
    segments.push({ x1, y1, x2, y2, minX: Math.min(x1, x2), minY: Math.min(y1, y2), maxX: Math.max(x1, x2), maxY: Math.max(y1, y2), ordinal: segments.length })
  }
  for (const command of outline.commands) {
    if (command === M) {
      x = firstX = coordinates[coordinateIndex++]
      y = firstY = coordinates[coordinateIndex++]
    } else if (command === L) {
      const endX = coordinates[coordinateIndex++]
      const endY = coordinates[coordinateIndex++]
      add(x, y, endX, endY)
      x = endX
      y = endY
    } else if (command === Q) {
      const controlX = coordinates[coordinateIndex++]
      const controlY = coordinates[coordinateIndex++]
      const endX = coordinates[coordinateIndex++]
      const endY = coordinates[coordinateIndex++]
      let previousX = x
      let previousY = y
      for (let index = 1; index < curvePoints; index++) {
        const t = index / (curvePoints - 1)
        const inverse = 1 - t
        const nextX = inverse * inverse * x + 2 * inverse * t * controlX + t * t * endX
        const nextY = inverse * inverse * y + 2 * inverse * t * controlY + t * t * endY
        add(previousX, previousY, nextX, nextY)
        previousX = nextX
        previousY = nextY
      }
      x = endX
      y = endY
    } else if (command === C) {
      const control1X = coordinates[coordinateIndex++]
      const control1Y = coordinates[coordinateIndex++]
      const control2X = coordinates[coordinateIndex++]
      const control2Y = coordinates[coordinateIndex++]
      const endX = coordinates[coordinateIndex++]
      const endY = coordinates[coordinateIndex++]
      let previousX = x
      let previousY = y
      for (let index = 1; index < curvePoints; index++) {
        const t = index / (curvePoints - 1)
        const inverse = 1 - t
        const nextX = inverse ** 3 * x + 3 * inverse * inverse * t * control1X + 3 * inverse * t * t * control2X + t ** 3 * endX
        const nextY = inverse ** 3 * y + 3 * inverse * inverse * t * control1Y + 3 * inverse * t * t * control2Y + t ** 3 * endY
        add(previousX, previousY, nextX, nextY)
        previousX = nextX
        previousY = nextY
      }
      x = endX
      y = endY
    } else if (command === Z) {
      add(x, y, firstX, firstY)
      x = firstX
      y = firstY
    }
  }
  return segments.sort((a, b) => a.maxX - b.maxX || a.ordinal - b.ordinal)
}

function squareDistance(x, y, segment) {
  const dx = segment.x2 - segment.x1
  const dy = segment.y2 - segment.y1
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared ? Math.max(0, Math.min(1, ((x - segment.x1) * dx + (y - segment.y1) * dy) / lengthSquared)) : 0
  return (x - (segment.x1 + t * dx)) ** 2 + (y - (segment.y1 + t * dy)) ** 2
}

function generate(input) {
  const segments = flatten(input.outline)
  const pixels = new Uint8Array(input.width * input.height)
  for (let x = 0; x < input.width && segments.length; x++) {
    for (let y = 0; y < input.height; y++) {
      const sampleX = input.viewBox.left + ((input.viewBox.right - input.viewBox.left) * (x + 0.5)) / input.width
      const sampleY = input.viewBox.bottom + ((input.viewBox.top - input.viewBox.bottom) * (y + 0.5)) / input.height
      let closest = Number.POSITIVE_INFINITY
      let closestSquared = Number.POSITIVE_INFINITY
      let winding = 0
      for (let index = segments.length - 1; index >= 0; index--) {
        const segment = segments[index]
        if (segment.maxX + closest <= sampleX) break
        if (sampleX + closest > segment.minX && sampleY - closest < segment.maxY && sampleY + closest > segment.minY) {
          const squared = squareDistance(sampleX, sampleY, segment)
          if (squared < closestSquared) {
            closestSquared = squared
            closest = Math.sqrt(squared)
          }
        }
      }
      for (let index = segments.length - 1; index >= 0; index--) {
        const segment = segments[index]
        if (segment.maxX <= sampleX) break
        const crosses = (segment.y1 > sampleY) !== (segment.y2 > sampleY) && sampleX < ((segment.x2 - segment.x1) * (sampleY - segment.y1)) / (segment.y2 - segment.y1) + segment.x1
        if (crosses) winding += segment.y1 < segment.y2 ? 1 : -1
      }
      const signed = winding === 0 ? closest : -closest
      const magnitude = Math.max(0, 1 - Math.abs(signed) / input.distance) ** input.exponent / 2
      const alpha = signed < 0 ? 1 - magnitude : magnitude
      pixels[y * input.width + x] = Math.max(0, Math.min(255, Math.round(alpha * 255)))
    }
  }
  return [...pixels]
}

const document = {
  schemaVersion: 1,
  reference: {
    package: 'webgl-sdf-generator',
    version: '1.1.1',
    shasum: '3e1b422b3d87cd3cc77f2602c9db63bc0f6accbd',
    integrity: 'sha512-9Z0JcMTFxeE+b2x1LJTdnaT8rT8aEp7MVxkNwoycNmJWwPdzoXzMh0BjJSh/AEFP+KPYZUli814h8bJZFIZ2jA==',
    license: 'MIT',
    correction: 'Clamp normalized distance before exponentiation to preserve documented saturation for every positive exponent.',
  },
  fixtures: cases.map((fixture) => ({ ...fixture, expected: { ...fixture, outline: undefined, intent: undefined, pixels: generate(fixture) } })),
}

for (const fixture of document.fixtures) {
  delete fixture.expected.outline
  delete fixture.expected.intent
  delete fixture.expected.id
}

await writeFile(output, `${JSON.stringify(document, null, 2)}\n`)

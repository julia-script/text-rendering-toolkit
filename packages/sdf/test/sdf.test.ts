import { readFile } from 'node:fs/promises'
import { expect, test } from 'vitest'
import {
  type GenerateSdfInput,
  generateSdf,
  InvalidSdfInputError,
  SdfCommand,
} from '../src/index.js'

interface Fixture {
  readonly id: string
  readonly intent: string
  readonly outline: { readonly commands: number[]; readonly coordinates: number[] }
  readonly viewBox: GenerateSdfInput['viewBox']
  readonly width: number
  readonly height: number
  readonly distance: number
  readonly exponent: number
  readonly expected: Omit<GenerateSdfInput, 'outline'> & { readonly pixels: number[] }
}

const fixtures = JSON.parse(
  await readFile(new URL('../../../test-fixtures/sdf/fixtures.json', import.meta.url), 'utf8'),
) as { fixtures: Fixture[] }

function input(fixture: Fixture): GenerateSdfInput {
  return {
    outline: {
      commands: Uint8Array.from(fixture.outline.commands),
      coordinates: Float32Array.from(fixture.outline.coordinates),
    },
    viewBox: fixture.viewBox,
    width: fixture.width,
    height: fixture.height,
    distance: fixture.distance,
    exponent: fixture.exponent,
  }
}

function rectangle(): GenerateSdfInput {
  return {
    outline: {
      commands: Uint8Array.from([
        SdfCommand.MOVE_TO,
        SdfCommand.LINE_TO,
        SdfCommand.LINE_TO,
        SdfCommand.LINE_TO,
        SdfCommand.CLOSE_PATH,
      ]),
      coordinates: Float32Array.from([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5]),
    },
    viewBox: { left: -1, bottom: -1, right: 1, top: 1 },
    width: 5,
    height: 5,
    distance: 1,
    exponent: 1,
  }
}

test('conforms to every synthetic golden fixture', () => {
  expect(fixtures.fixtures.map((fixture) => fixture.id)).toEqual([
    'open-line-distance',
    'quadratic-closed',
    'cubic-closed',
    'asymmetric-orientation',
    'multiple-contours-hole',
    'padded-rectangle',
    'clipped-contour',
    'empty-outline',
    'degenerate-outline',
    'exponential-distance',
  ])
  for (const fixture of fixtures.fixtures) {
    const result = generateSdf(input(fixture))
    expect({ ...result, pixels: [...result.pixels] }, `${fixture.id}: ${fixture.intent}`).toEqual(
      fixture.expected,
    )
  }
})

test('validates dimensions, encoding, view box, and typed arrays', () => {
  const valid = rectangle()
  const invalid: Array<[string, GenerateSdfInput]> = [
    ['width', { ...valid, width: 0 }],
    ['height', { ...valid, height: 1.5 }],
    ['allocation', { ...valid, width: 65_536, height: 65_536 }],
    ['viewBox.left', { ...valid, viewBox: { ...valid.viewBox, left: Number.NaN } }],
    ['positive width', { ...valid, viewBox: { ...valid.viewBox, left: 1 } }],
    ['positive height', { ...valid, viewBox: { ...valid.viewBox, bottom: 1 } }],
    ['distance', { ...valid, distance: 0 }],
    ['exponent', { ...valid, exponent: Number.POSITIVE_INFINITY }],
    [
      'Uint8Array',
      { ...valid, outline: { ...valid.outline, commands: [0] as unknown as Uint8Array } },
    ],
    [
      'Float32Array',
      { ...valid, outline: { ...valid.outline, coordinates: [0, 0] as unknown as Float32Array } },
    ],
  ]
  for (const [message, candidate] of invalid) {
    expect(() => generateSdf(candidate), message).toThrow(InvalidSdfInputError)
  }
})

test('rejects a request that is not a usable object before reading any field', () => {
  const valid = rectangle()
  const invalid: Array<[string, unknown]> = [
    ['null', null],
    ['undefined', undefined],
    ['number', 42],
    ['string', 'outline'],
    ['missing outline', { ...valid, outline: undefined }],
    ['null outline', { ...valid, outline: null }],
    ['null viewBox', { ...valid, viewBox: null }],
  ]
  for (const [message, candidate] of invalid) {
    expect(() => generateSdf(candidate as GenerateSdfInput), message).toThrow(InvalidSdfInputError)
  }
})

test('reports an unreadable property as invalid input and keeps the original as cause', () => {
  const valid = rectangle()
  const boom = new Error('getter exploded')
  const hostile = {
    ...valid,
    get width(): number {
      throw boom
    },
  }
  expect(() => generateSdf(hostile as GenerateSdfInput)).toThrow(InvalidSdfInputError)
  try {
    generateSdf(hostile as GenerateSdfInput)
    expect.unreachable('expected an InvalidSdfInputError')
  } catch (error) {
    expect(error).toBeInstanceOf(InvalidSdfInputError)
    expect((error as Error).cause).toBe(boom)
  }
})

test('samples the same field values it validated', () => {
  // A getter that passes validation and then reports a larger raster would
  // otherwise size the output by a value that was never checked.
  const valid = rectangle()
  let reads = 0
  const shifting = {
    ...valid,
    get width(): number {
      reads += 1
      return reads <= 1 ? 4 : 64
    },
  }
  const result = generateSdf(shifting as GenerateSdfInput)
  expect(result.width).toBe(4)
  expect(result.pixels.length).toBe(4 * result.height)
})

test('validates command data and leaves invalid input unchanged', () => {
  const cases: Array<[string, Uint8Array, Float32Array]> = [
    ['unknown', Uint8Array.from([9]), new Float32Array()],
    ['draws before', Uint8Array.from([SdfCommand.LINE_TO]), Float32Array.from([1, 1])],
    ['closes without', Uint8Array.from([SdfCommand.CLOSE_PATH]), new Float32Array()],
    ['too short', Uint8Array.from([SdfCommand.MOVE_TO]), Float32Array.from([1])],
    ['unused', Uint8Array.from([SdfCommand.MOVE_TO]), Float32Array.from([1, 1, 2])],
    ['finite', Uint8Array.from([SdfCommand.MOVE_TO]), Float32Array.from([1, Number.NaN])],
  ]
  for (const [message, commands, coordinates] of cases) {
    const candidate = { ...rectangle(), outline: { commands, coordinates } }
    const beforeCommands = [...commands]
    const beforeCoordinates = [...coordinates]
    expect(() => generateSdf(candidate), message).toThrow(message)
    expect([...commands]).toEqual(beforeCommands)
    expect([...coordinates]).toEqual(beforeCoordinates)
  }
})

test('preserves analytic encoding, orientation, winding, and ownership', () => {
  const first = generateSdf(rectangle())
  const second = generateSdf(rectangle())
  expect([...first.pixels]).toEqual([...second.pixels])
  expect(first.pixels).not.toBe(second.pixels)
  expect(first.viewBox).not.toBe(rectangle().viewBox)
  expect(first.pixels[2 * first.width + 2]).toBeGreaterThan(128)
  expect(first.pixels[0]).toBeLessThan(128)

  const line = fixtures.fixtures.find((fixture) => fixture.id === 'open-line-distance')
  const oriented = fixtures.fixtures.find((fixture) => fixture.id === 'asymmetric-orientation')
  const hole = fixtures.fixtures.find((fixture) => fixture.id === 'multiple-contours-hole')
  expect(line && generateSdf(input(line)).pixels[12]).toBe(128)
  expect(oriented && [...generateSdf(input(oriented)).pixels.slice(0, 4)]).not.toEqual(
    oriented && [...generateSdf(input(oriented)).pixels.slice(-4)],
  )
  expect(hole && generateSdf(input(hole)).pixels[24]).toBeLessThan(128)
})

test('supports open contours, consecutive moves, curves, and degenerate commands', () => {
  for (const id of [
    'open-line-distance',
    'quadratic-closed',
    'cubic-closed',
    'degenerate-outline',
  ]) {
    const fixture = fixtures.fixtures.find((item) => item.id === id)
    expect(fixture && generateSdf(input(fixture)).pixels.length).toBeGreaterThan(0)
  }
  const consecutiveMoves: GenerateSdfInput = {
    ...rectangle(),
    outline: {
      commands: Uint8Array.from([SdfCommand.MOVE_TO, SdfCommand.MOVE_TO, SdfCommand.LINE_TO]),
      coordinates: Float32Array.from([0, 0, -0.5, 0, 0.5, 0]),
    },
  }
  expect(generateSdf(consecutiveMoves).pixels.some((value) => value > 0)).toBe(true)
})

import * as ThreeTSL from 'three/tsl'
import {
  BufferAttribute,
  DataTexture,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  Matrix3,
  Mesh,
  MeshBasicNodeMaterial,
  NoColorSpace,
  type Node,
  RGBAFormat,
  UnsignedByteType,
  Vector2,
  Vector4,
} from 'three/webgpu'

import type { RenderFixture } from './fixture.js'

declare const floatNodeBrand: unique symbol
declare const uintNodeBrand: unique symbol
interface FloatNode {
  readonly [floatNodeBrand]: true
}
interface UintNode {
  readonly [uintNodeBrand]: true
}
interface Vec2Node {
  x: FloatNode
  y: FloatNode
  xy: Vec2Node
}
interface Vec3Node extends Vec2Node {}
interface Vec4Node extends Vec3Node {
  z: FloatNode
  w: FloatNode
  r: FloatNode
  g: FloatNode
  b: FloatNode
  a: FloatNode
  xy: Vec2Node
  zw: Vec2Node
}
interface UniformNode<T> {
  value: T
}

interface TslFacade {
  add(left: unknown, right: unknown): FloatNode
  attribute(name: string, type: 'uint'): UintNode
  attribute(name: string, type: 'vec3'): Vec3Node
  attribute(name: string, type: 'vec4'): Vec4Node
  cos(value: unknown): FloatNode
  div(left: unknown, right: unknown): FloatNode
  equal(left: unknown, right: unknown): FloatNode
  float(value: unknown): FloatNode
  floor(value: unknown): FloatNode
  fwidth(value: unknown): FloatNode
  max(left: unknown, right: unknown): FloatNode
  mix(left: unknown, right: unknown, factor: unknown): Vec2Node
  mod(left: unknown, right: unknown): FloatNode
  mul(left: unknown, right: unknown): FloatNode
  oneMinus(value: unknown): FloatNode
  positionLocal: Vec3Node
  select(condition: unknown, whenTrue: unknown, whenFalse: unknown): FloatNode
  sin(value: unknown): FloatNode
  smoothstep(edge0: unknown, edge1: unknown, value: unknown): FloatNode
  step(edge: unknown, value: unknown): FloatNode
  sub(left: unknown, right: unknown): FloatNode
  texture(texture: DataTexture, uv: unknown): Vec4Node
  uniform(value: number): FloatNode & UniformNode<number>
  uniform(value: Matrix3): UniformNode<Matrix3>
  uniform(value: Vector2): Vec2Node & UniformNode<Vector2>
  uniform(value: Vector4): Vec4Node & UniformNode<Vector4>
  uv(): Vec2Node
  varying(value: Vec2Node): Vec2Node
  vec2(x: unknown, y: unknown): Vec2Node
  vec3(x: unknown, y: unknown, z: unknown): Vec3Node
}

// The published TSL declarations are intentionally hidden behind this small typed facade. The
// private experiment only depends on these operations, and expanding Three's full fluent-node
// type graph makes TypeScript 7 consume unbounded memory even though the runtime graph is valid.
const tsl = ThreeTSL as unknown as TslFacade

export function createGlyphGeometry(fixture: RenderFixture): InstancedBufferGeometry {
  const geometry = new InstancedBufferGeometry()
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), 3),
  )
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2))
  geometry.setAttribute('glyphBounds', new InstancedBufferAttribute(fixture.instances.bounds, 4))
  geometry.setAttribute('glyphSlot', new InstancedBufferAttribute(fixture.instances.atlasSlots, 1))
  geometry.setAttribute(
    'glyphColor',
    new InstancedBufferAttribute(fixture.instances.colors, 3, true),
  )
  geometry.instanceCount = fixture.instances.atlasSlots.length
  return geometry
}

export function createAtlasTexture(fixture: RenderFixture): DataTexture {
  const atlas = new DataTexture(
    fixture.atlas.pixels,
    fixture.atlas.width,
    fixture.atlas.height,
    RGBAFormat,
    UnsignedByteType,
  )
  atlas.colorSpace = NoColorSpace
  atlas.generateMipmaps = false
  atlas.minFilter = LinearFilter
  atlas.magFilter = LinearFilter
  atlas.unpackAlignment = 1
  atlas.needsUpdate = true
  return atlas
}

export function createGlyphMaterial(atlas: DataTexture, cellSize: number) {
  const opacity = tsl.uniform(0.82)
  const clipRect = tsl.uniform(new Vector4(-10, -10, 10, 10))
  const orientation = tsl.uniform(new Matrix3())
  const curveRadius = tsl.uniform(10_000)
  const atlasGrid = tsl.uniform(
    new Vector2(atlas.image.width / cellSize, atlas.image.height / cellSize),
  )

  const bounds = tsl.attribute('glyphBounds', 'vec4')
  const slot = tsl.attribute('glyphSlot', 'uint')
  const glyphColor = tsl.attribute('glyphColor', 'vec3')
  const glyphPosition = tsl.mix(bounds.xy, bounds.zw, tsl.positionLocal.xy)
  const fragmentGlyphPosition = tsl.varying(glyphPosition)

  const angle = tsl.div(glyphPosition.x, curveRadius)
  const curvedPosition = tsl.vec3(
    tsl.mul(tsl.sin(angle), curveRadius),
    glyphPosition.y,
    tsl.sub(curveRadius, tsl.mul(tsl.cos(angle), curveRadius)),
  )

  const slotNumber = tsl.float(slot)
  const channel = tsl.mod(slotNumber, 4)
  const cell = tsl.floor(tsl.div(slotNumber, 4))
  const cellColumn = tsl.mod(cell, atlasGrid.x)
  const cellRow = tsl.floor(tsl.div(cell, atlasGrid.x))
  const atlasUv = tsl.div(tsl.add(tsl.vec2(cellColumn, cellRow), tsl.uv()), atlasGrid)
  const sample = tsl.texture(atlas, atlasUv)
  const encodedDistance = tsl.select(
    tsl.equal(channel, 0),
    sample.r,
    tsl.select(
      tsl.equal(channel, 1),
      sample.g,
      tsl.select(tsl.equal(channel, 2), sample.b, sample.a),
    ),
  )
  const edgeWidth = tsl.max(tsl.fwidth(encodedDistance), 1 / 255)
  const sdfCoverage = tsl.smoothstep(
    tsl.mul(tsl.oneMinus(edgeWidth), 0.5),
    tsl.mul(tsl.add(edgeWidth, 1), 0.5),
    encodedDistance,
  )
  const clipCoverage = tsl.mul(
    tsl.mul(
      tsl.step(clipRect.x, fragmentGlyphPosition.x),
      tsl.step(fragmentGlyphPosition.x, clipRect.z),
    ),
    tsl.mul(
      tsl.step(clipRect.y, fragmentGlyphPosition.y),
      tsl.step(fragmentGlyphPosition.y, clipRect.w),
    ),
  )

  const material = new MeshBasicNodeMaterial({
    depthWrite: false,
    side: DoubleSide,
    transparent: true,
  })
  material.positionNode = tsl.mul(orientation, curvedPosition) as unknown as Node<'vec3'>
  material.colorNode = glyphColor as unknown as Node<'vec3'>
  material.opacityNode = tsl.mul(
    tsl.mul(sdfCoverage, clipCoverage),
    opacity,
  ) as unknown as Node<'float'>

  return {
    material,
    controls: { opacity, clipRect, orientation, curveRadius },
  }
}

export function createGlyphMesh(fixture: RenderFixture) {
  const geometry = createGlyphGeometry(fixture)
  const atlas = createAtlasTexture(fixture)
  const { material, controls } = createGlyphMaterial(atlas, fixture.atlas.cellSize)
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  return { mesh, geometry, atlas, material, controls }
}

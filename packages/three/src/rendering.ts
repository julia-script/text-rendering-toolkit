import type { LayoutBounds } from '@webgpu-text/layout'
import * as ThreeTSL from 'three/tsl'
import {
  Box3,
  BufferAttribute,
  type DataTexture,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  type Node,
  Sphere,
  Vector2,
  Vector3,
  Vector4,
} from 'three/webgpu'

declare const floatNodeBrand: unique symbol
declare const uintNodeBrand: unique symbol
interface FloatNode {
  readonly [floatNodeBrand]: true
}
interface UintNode {
  readonly [uintNodeBrand]: true
}
interface BoolNode {
  readonly [floatNodeBrand]: true
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
  div(left: unknown, right: unknown): FloatNode
  equal(left: unknown, right: unknown): FloatNode
  float(value: unknown): FloatNode
  floor(value: unknown): FloatNode
  fwidth(value: unknown): FloatNode
  greaterThanEqual(left: unknown, right: unknown): BoolNode
  max(left: unknown, right: unknown): FloatNode
  mix(left: unknown, right: unknown, factor: unknown): Vec2Node
  mod(left: unknown, right: unknown): FloatNode
  mul(left: unknown, right: unknown): FloatNode
  oneMinus(value: unknown): FloatNode
  positionLocal: Vec3Node
  select(condition: unknown, whenTrue: unknown, whenFalse: unknown): FloatNode
  smoothstep(edge0: unknown, edge1: unknown, value: unknown): FloatNode
  step(edge: unknown, value: unknown): FloatNode
  texture(texture: DataTexture, uv: unknown): Vec4Node
  uniform(value: number): FloatNode & UniformNode<number>
  uniform(value: Vector2): Vec2Node & UniformNode<Vector2>
  uniform(value: Vector4): Vec4Node & UniformNode<Vector4>
  uv(): Vec2Node
  varying(value: Vec2Node): Vec2Node
  vec2(x: unknown, y: unknown): Vec2Node
  vec3(x: unknown, y: unknown, z: unknown): Vec3Node
  vec4(value: unknown, alpha: unknown): Vec4Node
}

// Three's complete fluent TSL declarations are too expensive for TypeScript 7 to expand here.
const tsl = ThreeTSL as unknown as TslFacade

export interface GlyphInstanceData {
  readonly bounds: Float32Array
  readonly slots: Uint32Array
  readonly colors: Uint8Array
  readonly count: number
}

export interface GlyphMaterialControls {
  readonly opacity: FloatNode & UniformNode<number>
  readonly clipRect: Vec4Node & UniformNode<Vector4>
  readonly atlasGrid: Vec2Node & UniformNode<Vector2>
}

export function createGlyphGeometry(): InstancedBufferGeometry {
  const geometry = new InstancedBufferGeometry()
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), 3),
  )
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2))
  geometry.setAttribute(
    'normal',
    new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]), 3),
  )
  geometry.setAttribute('glyphBounds', new InstancedBufferAttribute(new Float32Array(4), 4))
  geometry.setAttribute('glyphSlot', new InstancedBufferAttribute(new Uint32Array(1), 1))
  geometry.setAttribute('glyphColor', new InstancedBufferAttribute(new Uint8Array(3), 3, true))
  geometry.instanceCount = 0
  return geometry
}

function capacity(geometry: InstancedBufferGeometry): number {
  return (geometry.getAttribute('glyphSlot') as InstancedBufferAttribute).count
}

export function updateGlyphGeometry(
  geometry: InstancedBufferGeometry,
  data: GlyphInstanceData,
  renderBounds: LayoutBounds,
): void {
  const currentCapacity = capacity(geometry)
  if (data.count > currentCapacity) {
    let nextCapacity = currentCapacity
    while (nextCapacity < data.count) nextCapacity *= 2
    geometry.setAttribute(
      'glyphBounds',
      new InstancedBufferAttribute(new Float32Array(nextCapacity * 4), 4),
    )
    geometry.setAttribute(
      'glyphSlot',
      new InstancedBufferAttribute(new Uint32Array(nextCapacity), 1),
    )
    geometry.setAttribute(
      'glyphColor',
      new InstancedBufferAttribute(new Uint8Array(nextCapacity * 3), 3, true),
    )
  }
  const bounds = geometry.getAttribute('glyphBounds') as InstancedBufferAttribute
  const slots = geometry.getAttribute('glyphSlot') as InstancedBufferAttribute
  const colors = geometry.getAttribute('glyphColor') as InstancedBufferAttribute
  ;(bounds.array as Float32Array).set(data.bounds)
  ;(slots.array as Uint32Array).set(data.slots)
  ;(colors.array as Uint8Array).set(data.colors)
  bounds.needsUpdate = true
  slots.needsUpdate = true
  colors.needsUpdate = true
  geometry.instanceCount = data.count
  const minimum = new Vector3(renderBounds.left, renderBounds.bottom, 0)
  const maximum = new Vector3(renderBounds.right, renderBounds.top, 0)
  geometry.boundingBox = new Box3(minimum, maximum)
  const center = new Vector3().addVectors(minimum, maximum).multiplyScalar(0.5)
  geometry.boundingSphere = new Sphere(center, center.distanceTo(maximum))
}

function createGlyphNodeAssembly(atlas: DataTexture, sharedAtlasGrid = new Vector2(1, 1)) {
  const opacity = tsl.uniform(1)
  const clipRect = tsl.uniform(new Vector4(-1e20, -1e20, 1e20, 1e20))
  const atlasGrid = tsl.uniform(sharedAtlasGrid)
  const bounds = tsl.attribute('glyphBounds', 'vec4')
  const slot = tsl.attribute('glyphSlot', 'uint')
  const glyphColor = tsl.attribute('glyphColor', 'vec3')
  const glyphPosition = tsl.mix(bounds.xy, bounds.zw, tsl.positionLocal.xy)
  const fragmentGlyphPosition = tsl.varying(glyphPosition)
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
  const position = tsl.vec3(glyphPosition.x, glyphPosition.y, 0) as unknown as Node<'vec3'>
  const visibleOpacity = tsl.mul(
    tsl.mul(sdfCoverage, clipCoverage),
    opacity,
  ) as unknown as Node<'float'>
  const shadowMask = tsl.greaterThanEqual(
    tsl.mul(encodedDistance, clipCoverage),
    0.5,
  ) as unknown as Node<'bool'>
  return {
    controls: { opacity, clipRect, atlasGrid } satisfies GlyphMaterialControls,
    glyphColor: glyphColor as unknown as Node<'vec3'>,
    position,
    shadowMask,
    visibleOpacity,
  }
}

export function createGlyphMaterial(
  atlas: DataTexture,
  sharedAtlasGrid = new Vector2(1, 1),
  lit = false,
) {
  const nodes = createGlyphNodeAssembly(atlas, sharedAtlasGrid)
  if (lit) {
    const material = new MeshStandardNodeMaterial({
      depthWrite: false,
      metalness: 0,
      roughness: 0.9,
      transparent: true,
    })
    material.positionNode = nodes.position
    material.colorNode = tsl.vec4(nodes.glyphColor, 1) as unknown as Node<'vec4'>
    material.opacityNode = nodes.visibleOpacity
    material.maskShadowNode = nodes.shadowMask
    material.shadowSide = material.side
    return { material, controls: nodes.controls }
  }

  const material = new MeshBasicNodeMaterial({
    depthWrite: false,
    side: DoubleSide,
    transparent: true,
  })
  material.positionNode = nodes.position
  material.colorNode = nodes.glyphColor
  material.opacityNode = nodes.visibleOpacity
  return { material, controls: nodes.controls }
}

export function updateGlyphMaterial(
  controls: GlyphMaterialControls,
  opacity: number,
  clipRect: LayoutBounds | null,
): void {
  controls.opacity.value = opacity
  controls.clipRect.value.set(
    clipRect?.left ?? -1e20,
    clipRect?.bottom ?? -1e20,
    clipRect?.right ?? 1e20,
    clipRect?.top ?? 1e20,
  )
}

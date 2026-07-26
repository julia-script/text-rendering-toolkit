import type { LayoutBounds } from '@text-rendering-toolkit/layout'
import * as ThreeTSL from 'three/tsl'
import {
  Box3,
  BufferAttribute,
  Color,
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
interface Vec3Node extends Vec2Node {
  z: FloatNode
}
interface Vec4Node extends Vec3Node {
  z: FloatNode
  w: FloatNode
  r: FloatNode
  g: FloatNode
  b: FloatNode
  a: FloatNode
  rgb: Vec3Node
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
  pow(value: unknown, exponent: unknown): FloatNode
  positionLocal: Vec3Node
  select(condition: unknown, whenTrue: unknown, whenFalse: unknown): FloatNode
  smoothstep(edge0: unknown, edge1: unknown, value: unknown): FloatNode
  step(edge: unknown, value: unknown): FloatNode
  sub(left: unknown, right: unknown): FloatNode
  texture(texture: DataTexture, uv: unknown): Vec4Node
  uniform(value: number): FloatNode & UniformNode<number>
  uniform(value: Vector2): Vec2Node & UniformNode<Vector2>
  uniform(value: Color): Vec3Node & UniformNode<Color>
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
  /** Per instance: maximum layout-space SDF distance, exponent, effect eligibility. */
  readonly sdf: Float32Array
  readonly count: number
}

export interface GlyphMaterialPaint {
  readonly outlineColor: Color
  readonly outlineOpacity: number
  readonly outlineWidth: number
  readonly shadowColor: Color
  readonly shadowOpacity: number
  readonly shadowOffsetX: number
  readonly shadowOffsetY: number
  readonly shadowSoftness: number
}

export interface GlyphMaterialControls {
  readonly opacity: FloatNode & UniformNode<number>
  readonly clipRect: Vec4Node & UniformNode<Vector4>
  readonly atlasGrid: Vec2Node & UniformNode<Vector2>
  readonly outlineColor: Vec3Node & UniformNode<Color>
  readonly outlineOpacity: FloatNode & UniformNode<number>
  readonly outlineWidth: FloatNode & UniformNode<number>
  readonly shadowColor: Vec3Node & UniformNode<Color>
  readonly shadowOpacity: FloatNode & UniformNode<number>
  readonly shadowOffset: Vec2Node & UniformNode<Vector2>
  readonly shadowSoftness: FloatNode & UniformNode<number>
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
  geometry.setAttribute('glyphColor', new InstancedBufferAttribute(new Uint8Array(4), 4, true))
  geometry.setAttribute('glyphSdf', new InstancedBufferAttribute(new Float32Array(3), 3))
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
      new InstancedBufferAttribute(new Uint8Array(nextCapacity * 4), 4, true),
    )
    geometry.setAttribute(
      'glyphSdf',
      new InstancedBufferAttribute(new Float32Array(nextCapacity * 3), 3),
    )
  }
  const bounds = geometry.getAttribute('glyphBounds') as InstancedBufferAttribute
  const slots = geometry.getAttribute('glyphSlot') as InstancedBufferAttribute
  const colors = geometry.getAttribute('glyphColor') as InstancedBufferAttribute
  const sdf = geometry.getAttribute('glyphSdf') as InstancedBufferAttribute
  ;(bounds.array as Float32Array).set(data.bounds)
  ;(slots.array as Uint32Array).set(data.slots)
  ;(colors.array as Uint8Array).set(data.colors)
  ;(sdf.array as Float32Array).set(data.sdf)
  bounds.needsUpdate = true
  slots.needsUpdate = true
  colors.needsUpdate = true
  sdf.needsUpdate = true
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
  const outlineColor = tsl.uniform(new Color(0))
  const outlineOpacity = tsl.uniform(0)
  const outlineWidth = tsl.uniform(0)
  const shadowColor = tsl.uniform(new Color(0))
  const shadowOpacity = tsl.uniform(0)
  const shadowOffset = tsl.uniform(new Vector2())
  const shadowSoftness = tsl.uniform(0)
  const bounds = tsl.attribute('glyphBounds', 'vec4')
  const slot = tsl.attribute('glyphSlot', 'uint')
  const glyphColor = tsl.attribute('glyphColor', 'vec4')
  const glyphSdf = tsl.attribute('glyphSdf', 'vec3')
  const glyphPosition = tsl.mix(bounds.xy, bounds.zw, tsl.positionLocal.xy)
  const fragmentGlyphPosition = tsl.varying(glyphPosition)
  const slotNumber = tsl.float(slot)
  const channel = tsl.mod(slotNumber, 4)
  const cell = tsl.floor(tsl.div(slotNumber, 4))
  const cellColumn = tsl.mod(cell, atlasGrid.x)
  const cellRow = tsl.floor(tsl.div(cell, atlasGrid.x))
  const sampleDistance = (localUv: unknown) => {
    const atlasUv = tsl.div(tsl.add(tsl.vec2(cellColumn, cellRow), localUv), atlasGrid)
    const sample = tsl.texture(atlas, atlasUv)
    return tsl.select(
      tsl.equal(channel, 0),
      sample.r,
      tsl.select(
        tsl.equal(channel, 1),
        sample.g,
        tsl.select(tsl.equal(channel, 2), sample.b, sample.a),
      ),
    )
  }
  const localUv = tsl.uv()
  const encodedDistance = sampleDistance(localUv)
  const edgeWidth = tsl.max(tsl.fwidth(encodedDistance), 1 / 255)
  const fillCoverage = tsl.smoothstep(
    tsl.mul(tsl.oneMinus(edgeWidth), 0.5),
    tsl.mul(tsl.add(edgeWidth, 1), 0.5),
    encodedDistance,
  )
  const encodedThreshold = (distance: unknown) =>
    tsl.mul(tsl.pow(tsl.max(0, tsl.oneMinus(tsl.div(distance, glyphSdf.x))), glyphSdf.y), 0.5)
  const outlineThreshold = encodedThreshold(outlineWidth)
  const outlineCoverage = tsl.smoothstep(
    tsl.sub(outlineThreshold, edgeWidth),
    tsl.add(outlineThreshold, edgeWidth),
    encodedDistance,
  )
  const shadowUv = tsl.vec2(
    tsl.sub(localUv.x, tsl.div(shadowOffset.x, tsl.sub(bounds.z, bounds.x))),
    tsl.sub(localUv.y, tsl.div(shadowOffset.y, tsl.sub(bounds.w, bounds.y))),
  )
  const shadowInside = tsl.mul(
    tsl.mul(tsl.step(0, shadowUv.x), tsl.step(shadowUv.x, 1)),
    tsl.mul(tsl.step(0, shadowUv.y), tsl.step(shadowUv.y, 1)),
  )
  const shadowDistance = tsl.mul(sampleDistance(shadowUv), shadowInside)
  const shadowThreshold = encodedThreshold(shadowSoftness)
  const shadowCoverage = tsl.smoothstep(
    tsl.sub(shadowThreshold, edgeWidth),
    tsl.add(0.5, edgeWidth),
    shadowDistance,
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
  const fillAlpha = tsl.mul(fillCoverage, glyphColor.a)
  const outlineAlpha = tsl.mul(tsl.mul(outlineCoverage, outlineOpacity), glyphSdf.z)
  const shadowAlpha = tsl.mul(tsl.mul(shadowCoverage, shadowOpacity), glyphSdf.z)
  const outlineOverShadowAlpha = tsl.add(
    outlineAlpha,
    tsl.mul(shadowAlpha, tsl.oneMinus(outlineAlpha)),
  )
  const outlineOverShadowColor = tsl.add(
    tsl.mul(outlineColor, outlineAlpha),
    tsl.mul(tsl.mul(shadowColor, shadowAlpha), tsl.oneMinus(outlineAlpha)),
  )
  const composedAlpha = tsl.add(fillAlpha, tsl.mul(outlineOverShadowAlpha, tsl.oneMinus(fillAlpha)))
  const composedPremultiplied = tsl.add(
    tsl.mul(glyphColor.rgb, fillAlpha),
    tsl.mul(outlineOverShadowColor, tsl.oneMinus(fillAlpha)),
  )
  const composedColor = tsl.div(composedPremultiplied, tsl.max(composedAlpha, 1 / 255))
  const visibleOpacity = tsl.mul(
    tsl.mul(composedAlpha, clipCoverage),
    opacity,
  ) as unknown as Node<'float'>
  const sceneShadowCoverage = tsl.max(fillAlpha, outlineAlpha)
  const shadowMask = tsl.greaterThanEqual(
    tsl.mul(sceneShadowCoverage, clipCoverage),
    0.5,
  ) as unknown as Node<'bool'>
  return {
    controls: {
      opacity,
      clipRect,
      atlasGrid,
      outlineColor,
      outlineOpacity,
      outlineWidth,
      shadowColor,
      shadowOpacity,
      shadowOffset,
      shadowSoftness,
    } satisfies GlyphMaterialControls,
    glyphColor: composedColor as unknown as Node<'vec3'>,
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
    material.colorNode = nodes.glyphColor
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
  paint: GlyphMaterialPaint,
): void {
  controls.opacity.value = opacity
  controls.clipRect.value.set(
    clipRect?.left ?? -1e20,
    clipRect?.bottom ?? -1e20,
    clipRect?.right ?? 1e20,
    clipRect?.top ?? 1e20,
  )
  controls.outlineColor.value.copy(paint.outlineColor)
  controls.outlineOpacity.value = paint.outlineOpacity
  controls.outlineWidth.value = paint.outlineWidth
  controls.shadowColor.value.copy(paint.shadowColor)
  controls.shadowOpacity.value = paint.shadowOpacity
  controls.shadowOffset.value.set(paint.shadowOffsetX, paint.shadowOffsetY)
  controls.shadowSoftness.value = paint.shadowSoftness
}

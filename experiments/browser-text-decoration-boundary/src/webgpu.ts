import { generateSdf, SdfCommand } from '@text-rendering-toolkit/sdf'
import * as ThreeTSL from 'three/tsl'
import {
  AmbientLight,
  BufferGeometry,
  Color,
  DataTexture,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  NoColorSpace,
  type Node,
  type Object3D,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  UnsignedByteType,
  Vector2,
  WebGPURenderer,
  type WebGPURendererParameters,
} from 'three/webgpu'

import {
  type DecorationSegment,
  type PaintRequest,
  planSdfPaint,
  type Rgba,
  resolveDecorationColor,
  tessellateDecoration,
} from './index.js'

declare const floatNodeBrand: unique symbol
interface FloatNode {
  readonly [floatNodeBrand]: true
}
interface Vec2Node {
  readonly x: FloatNode
  readonly y: FloatNode
}
interface Vec3Node extends Vec2Node {}
interface Vec4Node extends Vec3Node {
  readonly r: FloatNode
  readonly g: FloatNode
  readonly b: FloatNode
  readonly a: FloatNode
}
interface UniformNode<T> {
  value: T
}
interface TslFacade {
  add(left: unknown, right: unknown): FloatNode
  div(left: unknown, right: unknown): FloatNode
  float(value: unknown): FloatNode
  fwidth(value: unknown): FloatNode
  max(left: unknown, right: unknown): FloatNode
  mix(left: unknown, right: unknown, factor: unknown): Vec3Node
  mul(left: unknown, right: unknown): FloatNode
  smoothstep(edge0: unknown, edge1: unknown, value: unknown): FloatNode
  sub(left: unknown, right: unknown): FloatNode
  texture(texture: DataTexture, uv: unknown): Vec4Node
  uniform(value: number): FloatNode & UniformNode<number>
  uniform(value: Color): Vec3Node & UniformNode<Color>
  uniform(value: Vector2): Vec2Node & UniformNode<Vector2>
  uv(): Vec2Node
  vec4(value: unknown, alpha: unknown): Vec4Node
}

const tsl = ThreeTSL as unknown as TslFacade
export const VIEWPORT = { width: 512, height: 256 } as const
const FOREGROUND = { red: 54, green: 92, blue: 180, alpha: 255 } as const

function threeColor(value: Rgba): Color {
  return new Color(value.red / 255, value.green / 255, value.blue / 255)
}

function sdfTexture(): DataTexture {
  const size = 64
  const bitmap = generateSdf({
    outline: {
      commands: new Uint8Array([
        SdfCommand.MOVE_TO,
        SdfCommand.LINE_TO,
        SdfCommand.LINE_TO,
        SdfCommand.LINE_TO,
        SdfCommand.CLOSE_PATH,
      ]),
      coordinates: new Float32Array([-0.5, -0.35, 0.5, -0.35, 0.5, 0.35, -0.5, 0.35]),
    },
    viewBox: { left: -0.75, bottom: -0.75, right: 0.75, top: 0.75 },
    width: size,
    height: size,
    distance: 0.25,
    exponent: 9,
  })
  const rgba = new Uint8Array(size * size * 4)
  for (let index = 0; index < bitmap.pixels.length; index++) {
    const value = bitmap.pixels[index] ?? 0
    const offset = index * 4
    rgba[offset] = value
    rgba[offset + 1] = value
    rgba[offset + 2] = value
    rgba[offset + 3] = 255
  }
  const texture = new DataTexture(rgba, size, size, RGBAFormat, UnsignedByteType)
  texture.colorSpace = NoColorSpace
  texture.generateMipmaps = false
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.unpackAlignment = 1
  texture.needsUpdate = true
  return texture
}

function paintNodes(texture: DataTexture, request: PaintRequest) {
  const fillColor = tsl.uniform(threeColor(request.fillColor))
  const outlineColor = tsl.uniform(threeColor(request.outlineColor))
  const shadowColor = tsl.uniform(threeColor(request.shadowColor))
  const outlineWidth = tsl.uniform(request.outlineWidthPixels / 64)
  const shadowSoftness = tsl.uniform(request.shadowSoftnessPixels / 64)
  const shadowOffset = tsl.uniform(
    new Vector2(-request.shadowOffsetXPixels / 64, -request.shadowOffsetYPixels / 64),
  )
  const shadowAlpha = tsl.uniform(request.shadowColor.alpha / 255)
  const sample = tsl.texture(texture, tsl.uv()).r
  const edge = tsl.max(tsl.fwidth(sample), 1 / 255)
  const fill = tsl.smoothstep(tsl.sub(0.5, edge), tsl.add(0.5, edge), sample)
  const outlineEdge = tsl.sub(0.5, outlineWidth)
  const outlined = tsl.smoothstep(tsl.sub(outlineEdge, edge), tsl.add(outlineEdge, edge), sample)
  const shadowSample = tsl.texture(texture, tsl.add(tsl.uv(), shadowOffset)).r
  const shadowEdge = tsl.sub(0.5, shadowSoftness)
  const shadow = tsl.smoothstep(tsl.sub(shadowEdge, edge), tsl.add(0.5, edge), shadowSample)
  const baseColor = tsl.mix(shadowColor, outlineColor, outlined)
  const composedColor = tsl.mix(baseColor, fillColor, fill)
  const opacity = tsl.max(outlined, tsl.mul(shadow, shadowAlpha))
  return {
    color: composedColor,
    opacity,
    controls: {
      fillColor,
      outlineColor,
      shadowColor,
      outlineWidth,
      shadowSoftness,
      shadowOffset,
      shadowAlpha,
    },
  }
}

function paintMesh(texture: DataTexture, request: PaintRequest, lit: boolean) {
  const geometry = new PlaneGeometry(1.25, 1.25)
  const nodes = paintNodes(texture, request)
  const material = lit
    ? new MeshStandardNodeMaterial({
        depthWrite: false,
        metalness: 0,
        roughness: 0.9,
        side: DoubleSide,
        transparent: true,
      })
    : new MeshBasicNodeMaterial({ depthWrite: false, side: DoubleSide, transparent: true })
  if (material instanceof MeshStandardNodeMaterial) {
    material.colorNode = tsl.vec4(nodes.color, 1) as unknown as Node<'vec4'>
  } else {
    material.colorNode = nodes.color as unknown as Node<'vec3'>
  }
  material.opacityNode = nodes.opacity as unknown as Node<'float'>
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  return { mesh, geometry, material, controls: nodes.controls }
}

function decorationMesh(segment: DecorationSegment): Mesh<BufferGeometry, MeshBasicMaterial> {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(tessellateDecoration(segment), 3))
  const resolved = resolveDecorationColor(segment.color, FOREGROUND)
  const material = new MeshBasicMaterial({
    color: threeColor(resolved),
    opacity: resolved.alpha / 255,
    side: DoubleSide,
    transparent: resolved.alpha < 255,
  })
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  return mesh
}

function decorationSegments(): readonly DecorationSegment[] {
  const base = {
    sourceStart: 0,
    sourceEnd: 6,
    lineIndex: 0,
    kind: 'underline' as const,
    xStart: -1.8,
    xEnd: -0.25,
    thickness: 0.055,
    phase: 0,
    skipInk: 'none' as const,
  }
  return [
    {
      ...base,
      style: 'solid',
      color: { red: 14, green: 165, blue: 233, alpha: 255 },
      y: 0.66,
      amplitude: 0,
      wavelength: 0,
    },
    {
      ...base,
      style: 'dotted',
      color: 'foreground',
      y: 0.24,
      amplitude: 0,
      wavelength: 0.18,
    },
    {
      ...base,
      style: 'wavy',
      color: { red: 249, green: 115, blue: 22, alpha: 255 },
      y: -0.2,
      amplitude: 0.075,
      wavelength: 0.32,
    },
    {
      ...base,
      kind: 'strikethrough',
      style: 'solid',
      color: { red: 168, green: 85, blue: 247, alpha: 255 },
      y: -0.64,
      amplitude: 0,
      wavelength: 0,
    },
  ]
}

export async function createValidationHarness(container: HTMLElement, request: PaintRequest) {
  const initialPlan = planSdfPaint(request, 64)
  if (!initialPlan.accepted) throw new RangeError(initialPlan.reason ?? 'paint is unsupported')
  if (!navigator.gpu) throw new Error('WebGPU is unavailable; WebGL is not evidence')
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' })
  if (!adapter) throw new Error('No WebGPU adapter is available')
  const renderer = new WebGPURenderer({ alpha: true, antialias: false } as WebGPURendererParameters)
  renderer.setPixelRatio(1)
  renderer.setSize(VIEWPORT.width, VIEWPORT.height, false)
  renderer.setClearColor(new Color(0x000000), 0)
  await renderer.init()
  if (
    (renderer.backend as typeof renderer.backend & { isWebGPUBackend?: boolean })
      .isWebGPUBackend !== true
  ) {
    renderer.dispose()
    throw new Error('Three selected a non-WebGPU backend')
  }
  container.append(renderer.domElement)
  const scene = new Scene()
  const camera = new OrthographicCamera(-2, 2, 1, -1, 0.1, 10)
  camera.position.z = 4
  const texture = sdfTexture()
  const unlit = paintMesh(texture, request, false)
  const lit = paintMesh(texture, request, true)
  unlit.mesh.position.set(1.05, 0.42, 0)
  lit.mesh.position.set(1.05, -0.52, 0)
  const decorations = decorationSegments().map(decorationMesh)
  const ambient = new AmbientLight(0xffffff, 0.7)
  const directional = new DirectionalLight(0xffffff, 2)
  directional.position.set(-2, 2, 3)
  scene.add(unlit.mesh, lit.mesh, ...decorations, ambient, directional)
  let disposed = false

  return {
    renderer,
    texture,
    materialVariants: ['unlit', 'planar-lit'] as const,
    adapterInfo: {
      architecture: adapter.info.architecture,
      description: adapter.info.description,
      device: adapter.info.device,
      vendor: adapter.info.vendor,
    },
    add(object: Object3D): void {
      scene.add(object)
    },
    remove(object: Object3D): void {
      scene.remove(object)
    },
    async render(): Promise<void> {
      renderer.render(scene, camera)
      await Promise.resolve()
    },
    async capture(): Promise<ImageData> {
      const blob = await new Promise<Blob>((resolve, reject) => {
        renderer.domElement.toBlob((value) =>
          value ? resolve(value) : reject(new Error('Unable to capture WebGPU canvas')),
        )
      })
      const bitmap = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = VIEWPORT.width
      canvas.height = VIEWPORT.height
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('2D capture context is unavailable')
      context.drawImage(bitmap, 0, 0)
      bitmap.close()
      return context.getImageData(0, 0, canvas.width, canvas.height)
    },
    update(next: PaintRequest): void {
      const plan = planSdfPaint(next, 64)
      if (!plan.accepted) throw new RangeError(plan.reason ?? 'paint is unsupported')
      for (const target of [unlit.controls, lit.controls]) {
        target.fillColor.value.copy(threeColor(next.fillColor))
        target.outlineColor.value.copy(threeColor(next.outlineColor))
        target.shadowColor.value.copy(threeColor(next.shadowColor))
        target.outlineWidth.value = next.outlineWidthPixels / 64
        target.shadowSoftness.value = next.shadowSoftnessPixels / 64
        target.shadowOffset.value.set(
          -next.shadowOffsetXPixels / 64,
          -next.shadowOffsetYPixels / 64,
        )
        target.shadowAlpha.value = next.shadowColor.alpha / 255
      }
    },
    snapshot() {
      return {
        textureUuid: texture.uuid,
        textureWidth: texture.image.width as number,
        textureHeight: texture.image.height as number,
        borrowerCount: 2,
        outlineWidth: unlit.controls.outlineWidth.value,
      }
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      scene.clear()
      for (const mesh of decorations) {
        mesh.geometry.dispose()
        mesh.material.dispose()
      }
      unlit.geometry.dispose()
      unlit.material.dispose()
      lit.geometry.dispose()
      lit.material.dispose()
      texture.dispose()
      directional.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}

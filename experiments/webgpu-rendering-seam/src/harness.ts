import {
  Color,
  type InstancedBufferAttribute,
  Matrix3,
  OrthographicCamera,
  Scene,
  Vector4,
  WebGPURenderer,
} from 'three/webgpu'

import { createRenderFixture } from './fixture.js'
import { createGlyphMesh } from './rendering.js'

export const VIEWPORT = { width: 512, height: 256 } as const
export const CLEAR_COLOR = new Color(0x101820)

export class UnsupportedWebGPUError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsupportedWebGPUError'
  }
}

export interface BackendDiagnostic {
  isWebGPUBackend?: boolean
}

export function assertWebGPUBackend(backend: BackendDiagnostic): void {
  if (backend.isWebGPUBackend !== true) {
    throw new UnsupportedWebGPUError('Three.js selected a non-WebGPU backend')
  }
}

export interface AppearanceOptions {
  clipRect?: Vector4
  curveRadius?: number
  opacity?: number
  rotation?: number
}

export async function createRenderHarness(container: HTMLElement) {
  if (!navigator.gpu) {
    throw new UnsupportedWebGPUError('navigator.gpu is unavailable; WebGL fallback is not evidence')
  }

  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' })
  if (!adapter) {
    throw new UnsupportedWebGPUError(
      'no WebGPU adapter is available; WebGL fallback is not evidence',
    )
  }

  const fixture = createRenderFixture()
  const renderer = new WebGPURenderer({
    alpha: false,
    antialias: false,
  })
  renderer.setPixelRatio(1)
  renderer.setSize(VIEWPORT.width, VIEWPORT.height, false)
  await renderer.init()

  const backend = renderer.backend as typeof renderer.backend & BackendDiagnostic
  try {
    assertWebGPUBackend(backend)
  } catch (error) {
    renderer.dispose()
    throw error
  }

  const scene = new Scene()
  scene.background = CLEAR_COLOR
  const camera = new OrthographicCamera(-2, 2, 1, -1, 0.1, 10)
  camera.position.z = 3

  const resources = createGlyphMesh(fixture)
  scene.add(resources.mesh)
  container.append(renderer.domElement)

  const adapterInfo = {
    architecture: adapter.info.architecture,
    description: adapter.info.description,
    device: adapter.info.device,
    vendor: adapter.info.vendor,
  }

  return {
    renderer,
    resources,
    adapterInfo,
    async render() {
      renderer.render(scene, camera)
      await Promise.resolve()
    },
    setAppearance(options: AppearanceOptions) {
      if (options.opacity !== undefined) resources.controls.opacity.value = options.opacity
      if (options.curveRadius !== undefined) {
        if (!Number.isFinite(options.curveRadius) || Math.abs(options.curveRadius) < 0.1) {
          throw new RangeError('curve radius must be finite and have magnitude of at least 0.1')
        }
        resources.controls.curveRadius.value = options.curveRadius
      }
      if (options.clipRect) resources.controls.clipRect.value.copy(options.clipRect)
      if (options.rotation !== undefined) {
        const cosine = Math.cos(options.rotation)
        const sine = Math.sin(options.rotation)
        resources.controls.orientation.value.set(cosine, -sine, 0, sine, cosine, 0, 0, 0, 1)
      }
    },
    mutateAtlasChannel(channel: number) {
      if (!Number.isInteger(channel) || channel < 0 || channel > 3) {
        throw new RangeError('atlas channel must be an integer from 0 through 3')
      }
      for (let offset = channel; offset < fixture.atlas.pixels.length; offset += 4) {
        fixture.atlas.pixels[offset] = 255 - (fixture.atlas.pixels[offset] ?? 0)
      }
      resources.atlas.needsUpdate = true
    },
    mutateInstance(index: number, bounds: readonly [number, number, number, number], color: Color) {
      const boundsAttribute = resources.geometry.getAttribute(
        'glyphBounds',
      ) as InstancedBufferAttribute
      const colorAttribute = resources.geometry.getAttribute(
        'glyphColor',
      ) as InstancedBufferAttribute
      if (!Number.isInteger(index) || index < 0 || index >= boundsAttribute.count) {
        throw new RangeError('instance index is outside the fixture')
      }
      boundsAttribute.setXYZW(index, ...bounds)
      colorAttribute.setXYZ(index, color.r * 255, color.g * 255, color.b * 255)
      boundsAttribute.needsUpdate = true
      colorAttribute.needsUpdate = true
    },
    async capturePixels(): Promise<ImageData> {
      const blob = await new Promise<Blob>((resolve, reject) => {
        renderer.domElement.toBlob((value) => {
          if (value) resolve(value)
          else reject(new Error('the WebGPU canvas could not be captured'))
        })
      })
      const bitmap = await createImageBitmap(blob)
      const copy = document.createElement('canvas')
      copy.width = VIEWPORT.width
      copy.height = VIEWPORT.height
      const context = copy.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('2D capture context is unavailable')
      context.drawImage(bitmap, 0, 0)
      bitmap.close()
      return context.getImageData(0, 0, copy.width, copy.height)
    },
    dispose() {
      scene.remove(resources.mesh)
      resources.geometry.dispose()
      resources.material.dispose()
      resources.atlas.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}

export function defaultAppearance() {
  return {
    clipRect: new Vector4(-10, -10, 10, 10),
    curveRadius: 10_000,
    opacity: 0.82,
    orientation: new Matrix3(),
  }
}

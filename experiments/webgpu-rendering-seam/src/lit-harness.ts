import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardNodeMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
} from 'three/webgpu'

import { createRenderFixture } from './fixture.js'
import { CLEAR_COLOR, createWebGPUHarnessContext } from './harness.js'
import { createLitGlyphMesh } from './rendering.js'

export type LitSceneMode = 'ambient' | 'cast' | 'lit' | 'receive' | 'shadow'

export async function createLitShadowHarness(container: HTMLElement) {
  const context = await createWebGPUHarnessContext(container)
  const { renderer } = context
  renderer.shadowMap.enabled = true

  const scene = new Scene()
  scene.background = CLEAR_COLOR
  const camera = new OrthographicCamera(-2, 2, 1, -1, 0.1, 10)
  camera.position.z = 5

  const text = createLitGlyphMesh(createRenderFixture())
  text.controls.opacity.value = 1

  const receiverGeometry = new PlaneGeometry(4, 2)
  const receiverMaterial = new MeshStandardNodeMaterial({
    color: new Color(0x78828c),
    metalness: 0,
    roughness: 1,
  })
  const receiver = new Mesh(receiverGeometry, receiverMaterial)
  receiver.position.z = -0.6

  const occluderGeometry = new BoxGeometry(0.32, 0.32, 0.06)
  const occluderMaterial = new MeshStandardNodeMaterial({
    color: new Color(0xffffff),
    metalness: 0,
    roughness: 1,
  })
  const occluder = new Mesh(occluderGeometry, occluderMaterial)
  occluder.position.set(-0.25, 1.2, 1.2)

  const ambient = new AmbientLight(0xffffff, 0.12)
  const directional = new DirectionalLight(0xffffff, 2.4)
  directional.position.set(-3, 3, 5)
  directional.target.position.set(0, 0, 0)
  directional.shadow.mapSize.set(1024, 1024)
  directional.shadow.camera.left = -4
  directional.shadow.camera.right = 4
  directional.shadow.camera.top = 3
  directional.shadow.camera.bottom = -3
  directional.shadow.camera.near = 0.1
  directional.shadow.camera.far = 12
  directional.shadow.camera.updateProjectionMatrix()
  directional.shadow.bias = -0.0005
  directional.shadow.normalBias = 0.01

  scene.add(receiver, text.mesh, occluder, ambient, directional, directional.target)

  function setMode(mode: LitSceneMode) {
    const castText = mode === 'cast' || mode === 'shadow'
    const receiveOnText = mode === 'receive' || mode === 'shadow'
    const shadows = castText || receiveOnText
    directional.intensity = mode === 'ambient' ? 0 : 2.4
    directional.castShadow = shadows
    text.mesh.castShadow = castText
    text.mesh.receiveShadow = receiveOnText
    receiver.receiveShadow = castText
    occluder.castShadow = receiveOnText
  }

  let disposed = false
  setMode('lit')

  return {
    renderer,
    adapterInfo: context.adapterInfo,
    text,
    receiver,
    occluder,
    directional,
    setMode,
    async render() {
      renderer.render(scene, camera)
      await Promise.resolve()
    },
    capturePixels: context.capturePixels,
    dispose() {
      if (disposed) return
      disposed = true
      scene.clear()
      text.dispose()
      receiverGeometry.dispose()
      receiverMaterial.dispose()
      occluderGeometry.dispose()
      occluderMaterial.dispose()
      directional.dispose()
      context.dispose()
    },
  }
}

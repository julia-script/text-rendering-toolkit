'use client'

import { layoutText } from '@webgpu-text/layout'
import { Text, TextResources } from '@webgpu-text/three'
import { useEffect, useRef, useState } from 'react'
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardNodeMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  WebGPURenderer,
} from 'three/webgpu'
import { errorMessage, loadDemoFonts } from './demo-fonts'

type State =
  | { readonly status: 'loading' }
  | { readonly status: 'unsupported' }
  | { readonly status: 'ready' }
  | { readonly status: 'error'; readonly message: string }

export function ThreeExampleClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const forceUnsupported = new URL(window.location.href).searchParams.get('webgpu') === 'off'
    if (forceUnsupported || !('gpu' in navigator) || !navigator.gpu) {
      setState({ status: 'unsupported' })
      return
    }

    const controller = new AbortController()
    let cleanup: (() => void) | undefined
    void start(canvas, controller.signal)
      .then((dispose) => {
        if (controller.signal.aborted) dispose()
        else {
          cleanup = dispose
          setState({ status: 'ready' })
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', message: errorMessage(error) })
      })
    return () => {
      controller.abort()
      cleanup?.()
    }
  }, [])

  if (state.status === 'unsupported') {
    return (
      <p className="rounded-lg bg-fd-muted p-4 text-sm">
        WebGPU is not available in this browser. The layout and CPU SDF examples still work.
      </p>
    )
  }
  if (state.status === 'error') {
    return (
      <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
        {state.message}
      </p>
    )
  }
  return (
    <div className="relative min-h-72 overflow-hidden rounded-lg bg-[#101820]">
      <canvas className="absolute inset-0 size-full" ref={canvasRef} />
      {state.status === 'loading' ? (
        <p className="absolute inset-0 grid place-items-center text-sm text-white/70">
          Initializing WebGPU…
        </p>
      ) : null}
    </div>
  )
}

async function start(canvas: HTMLCanvasElement, signal: AbortSignal): Promise<() => void> {
  const ownedFonts = await loadDemoFonts(signal)
  let renderer: WebGPURenderer | undefined
  let texts: Text[] = []
  let resources: TextResources | undefined
  let receiverGeometry: PlaneGeometry | undefined
  let receiverMaterial: MeshStandardNodeMaterial | undefined
  let directional: DirectionalLight | undefined
  let observer: ResizeObserver | undefined

  const dispose = () => {
    observer?.disconnect()
    renderer?.setAnimationLoop(null)
    for (const text of texts) text.dispose()
    resources?.dispose()
    receiverGeometry?.dispose()
    receiverMaterial?.dispose()
    directional?.dispose()
    ownedFonts.dispose()
    renderer?.dispose()
  }

  try {
    renderer = new WebGPURenderer({ canvas, antialias: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    await renderer.init()
    if (signal.aborted) throw new DOMException('WebGPU initialization was cancelled', 'AbortError')
    renderer.shadowMap.enabled = true

    const scene = new Scene()
    scene.background = new Color(0x101820)
    const camera = new OrthographicCamera(-2, 2, 0.8, -0.8, 0.1, 10)
    camera.position.z = 3

    const layout = layoutText(
      {
        text: 'WebGPU مرحبا',
        style: {
          key: 'display',
          fontKeys: ['latin', 'arabic'],
          fontSize: 0.45,
          language: 'und',
        },
        layout: {
          anchorX: 'center',
          anchorY: 'middle',
        },
      },
      ownedFonts.fonts,
    )
    const labelLayout = layoutText(
      {
        text: 'Shared glyph resources',
        style: {
          key: 'label',
          fontKeys: ['latin', 'arabic'],
          fontSize: 0.2,
          language: 'und',
        },
        layout: {
          anchorX: 'center',
          anchorY: 'middle',
        },
      },
      ownedFonts.fonts,
    )
    resources = new TextResources({ sdfSize: 64 })
    const title = new Text({
      layout,
      fonts: ownedFonts.fonts,
      resources,
      lit: true,
      color: 0x55d8ff,
    })
    const label = new Text({
      layout: labelLayout,
      fonts: ownedFonts.fonts,
      resources,
      lit: true,
      color: 0xffcc55,
    })
    texts = [title, label]
    await Promise.all(texts.map((text) => text.sync()))
    title.position.y = 0.25
    label.position.y = -0.4
    for (const text of texts) {
      text.castShadow = true
      text.receiveShadow = true
    }

    receiverGeometry = new PlaneGeometry(6, 2)
    receiverMaterial = new MeshStandardNodeMaterial({ color: 0x36424a, roughness: 1 })
    const receiver = new Mesh(receiverGeometry, receiverMaterial)
    receiver.position.z = -0.35
    receiver.receiveShadow = true
    const ambient = new AmbientLight(0xffffff, 0.25)
    directional = new DirectionalLight(0xffffff, 2)
    directional.position.set(-2, 2, 3)
    directional.castShadow = true
    scene.add(receiver, ...texts, ambient, directional)

    const resize = () => {
      const width = Math.max(canvas.clientWidth, 320)
      const height = Math.max(canvas.clientHeight, 288)
      const aspect = width / height
      camera.left = -aspect
      camera.right = aspect
      camera.top = 1
      camera.bottom = -1
      camera.updateProjectionMatrix()
      renderer?.setSize(width, height, false)
    }
    observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    renderer.setAnimationLoop((time) => {
      for (const text of texts) text.rotation.z = Math.sin(time * 0.0004) * 0.02
      renderer?.render(scene, camera)
    })
    return dispose
  } catch (error) {
    dispose()
    throw error
  }
}

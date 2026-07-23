'use client'

import { layoutText } from '@webgpu-text/layout'
import { Text, TextResources } from '@webgpu-text/three'
import { useEffect, useRef, useState } from 'react'
import { Color, OrthographicCamera, Scene, WebGPURenderer } from 'three/webgpu'
import { errorMessage, loadDemoFonts } from './demo-fonts'

type State =
  | { readonly status: 'loading' }
  | { readonly status: 'unsupported' }
  | { readonly status: 'ready' }
  | { readonly status: 'error'; readonly message: string }

interface PaintSettings {
  readonly outlineEnabled: boolean
  readonly outlineWidth: number
  readonly outlineColor: string
  readonly shadowEnabled: boolean
  readonly shadowOffsetX: number
  readonly shadowOffsetY: number
  readonly shadowSoftness: number
  readonly shadowColor: string
}

const DEFAULT_PAINT: PaintSettings = {
  outlineEnabled: true,
  outlineWidth: 0.01,
  outlineColor: '#2563eb',
  shadowEnabled: true,
  shadowOffsetX: 0.025,
  shadowOffsetY: -0.025,
  shadowSoftness: 0.03,
  shadowColor: '#7c3aed',
}

export function ThreeExampleClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const updateRef = useRef<((paint: PaintSettings) => Promise<void>) | null>(null)
  const [state, setState] = useState<State>({ status: 'loading' })
  const [paint, setPaint] = useState(DEFAULT_PAINT)
  const [paintError, setPaintError] = useState<string | null>(null)

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
    void start(canvas, controller.signal, (update) => {
      updateRef.current = update
    })
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
      updateRef.current = null
      controller.abort()
      cleanup?.()
    }
  }, [])

  useEffect(() => {
    if (state.status !== 'ready' || !updateRef.current) return
    void updateRef.current(paint).then(
      () => setPaintError(null),
      (error: unknown) => setPaintError(errorMessage(error)),
    )
  }, [paint, state.status])

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
    <div className="grid gap-3">
      <div className="relative min-h-60 overflow-hidden rounded-xl border bg-[#e8edf5]">
        <canvas className="absolute inset-0 size-full" ref={canvasRef} />
        {state.status === 'loading' ? (
          <p className="absolute inset-0 grid place-items-center text-sm text-slate-600">
            Initializing WebGPU…
          </p>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <fieldset className="grid gap-4 rounded-xl border bg-fd-card p-4 text-sm">
          <legend className="px-2">
            <label className="flex items-center gap-2 font-medium">
              <input
                checked={paint.outlineEnabled}
                onChange={(event) =>
                  setPaint((value) => ({ ...value, outlineEnabled: event.target.checked }))
                }
                type="checkbox"
              />
              Outline
            </label>
          </legend>
          <div
            className={`grid gap-4 sm:grid-cols-[minmax(0,1fr)_4rem] ${
              paint.outlineEnabled ? '' : 'opacity-45'
            }`}
          >
            <label className="grid gap-2">
              <span className="flex justify-between gap-3">
                Width <output>{paint.outlineWidth.toFixed(3)}</output>
              </span>
              <input
                aria-label="Outline width"
                disabled={!paint.outlineEnabled}
                max="0.03"
                min="0"
                onChange={(event) =>
                  setPaint((value) => ({ ...value, outlineWidth: Number(event.target.value) }))
                }
                step="0.001"
                type="range"
                value={paint.outlineWidth}
              />
            </label>
            <label className="grid gap-2">
              Color
              <input
                aria-label="Outline color"
                className="h-9 w-full rounded border"
                disabled={!paint.outlineEnabled}
                onChange={(event) =>
                  setPaint((value) => ({ ...value, outlineColor: event.target.value }))
                }
                type="color"
                value={paint.outlineColor}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="grid gap-4 rounded-xl border bg-fd-card p-4 text-sm">
          <legend className="px-2">
            <label className="flex items-center gap-2 font-medium">
              <input
                checked={paint.shadowEnabled}
                onChange={(event) =>
                  setPaint((value) => ({ ...value, shadowEnabled: event.target.checked }))
                }
                type="checkbox"
              />
              Drop shadow
            </label>
          </legend>
          <div className={`grid gap-4 sm:grid-cols-2 ${paint.shadowEnabled ? '' : 'opacity-45'}`}>
            <label className="grid gap-2">
              <span className="flex justify-between gap-3">
                Horizontal <output>{paint.shadowOffsetX.toFixed(3)}</output>
              </span>
              <input
                aria-label="Shadow horizontal offset"
                disabled={!paint.shadowEnabled}
                max="0.05"
                min="-0.05"
                onChange={(event) =>
                  setPaint((value) => ({ ...value, shadowOffsetX: Number(event.target.value) }))
                }
                step="0.001"
                type="range"
                value={paint.shadowOffsetX}
              />
            </label>
            <label className="grid gap-2">
              <span className="flex justify-between gap-3">
                Vertical <output>{paint.shadowOffsetY.toFixed(3)}</output>
              </span>
              <input
                aria-label="Shadow vertical offset"
                disabled={!paint.shadowEnabled}
                max="0.05"
                min="-0.05"
                onChange={(event) =>
                  setPaint((value) => ({ ...value, shadowOffsetY: Number(event.target.value) }))
                }
                step="0.001"
                type="range"
                value={paint.shadowOffsetY}
              />
            </label>
            <label className="grid gap-2">
              <span className="flex justify-between gap-3">
                Softness <output>{paint.shadowSoftness.toFixed(3)}</output>
              </span>
              <input
                aria-label="Shadow softness"
                disabled={!paint.shadowEnabled}
                max="0.08"
                min="0"
                onChange={(event) =>
                  setPaint((value) => ({ ...value, shadowSoftness: Number(event.target.value) }))
                }
                step="0.002"
                type="range"
                value={paint.shadowSoftness}
              />
            </label>
            <label className="grid gap-2">
              Color
              <input
                aria-label="Shadow color"
                className="h-9 w-full rounded border"
                disabled={!paint.shadowEnabled}
                onChange={(event) =>
                  setPaint((value) => ({ ...value, shadowColor: event.target.value }))
                }
                type="color"
                value={paint.shadowColor}
              />
            </label>
          </div>
        </fieldset>
      </div>
      <div className="flex justify-end">
        <button
          className="rounded-lg border bg-fd-card px-3 py-1.5 text-sm hover:bg-fd-muted"
          onClick={() => setPaint(DEFAULT_PAINT)}
          type="button"
        >
          Reset
        </button>
      </div>
      {paintError ? <p className="text-xs text-red-600 dark:text-red-300">{paintError}</p> : null}
    </div>
  )
}

async function start(
  canvas: HTMLCanvasElement,
  signal: AbortSignal,
  onReady: (update: (paint: PaintSettings) => Promise<void>) => void,
): Promise<() => void> {
  const ownedFonts = await loadDemoFonts(signal)
  let renderer: WebGPURenderer | undefined
  let text: Text | undefined
  let resources: TextResources | undefined
  let observer: ResizeObserver | undefined

  const dispose = () => {
    observer?.disconnect()
    text?.dispose()
    resources?.dispose()
    ownedFonts.dispose()
    renderer?.dispose()
  }

  try {
    renderer = new WebGPURenderer({ canvas, antialias: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    await renderer.init()
    if (signal.aborted) throw new DOMException('WebGPU initialization was cancelled', 'AbortError')

    const scene = new Scene()
    scene.background = new Color(0xe8edf5)
    const camera = new OrthographicCamera(-2, 2, 0.8, -0.8, 0.1, 10)
    camera.position.z = 3

    const layout = layoutText(
      {
        text: 'Hello مرحبا',
        style: {
          key: 'display',
          fontKeys: ['latin', 'arabic'],
          fontSize: 0.52,
          language: 'und',
        },
        layout: {
          anchorX: 'center',
          anchorY: 'middle',
        },
      },
      ownedFonts.fonts,
    )
    resources = new TextResources({ sdfSize: 128, sdfPadding: 0.75 })
    const title = new Text({
      layout,
      fonts: ownedFonts.fonts,
      resources,
      color: 0x111827,
      outline: {
        width: DEFAULT_PAINT.outlineWidth,
        color: DEFAULT_PAINT.outlineColor,
        opacity: 0.95,
      },
      shadow: {
        offsetX: DEFAULT_PAINT.shadowOffsetX,
        offsetY: DEFAULT_PAINT.shadowOffsetY,
        softness: DEFAULT_PAINT.shadowSoftness,
        color: DEFAULT_PAINT.shadowColor,
        opacity: 0.5,
      },
    })
    text = title
    await title.sync()
    scene.add(title)

    const render = () => renderer?.render(scene, camera)
    onReady(async (next) => {
      title.outline = next.outlineEnabled
        ? {
            width: next.outlineWidth,
            color: next.outlineColor,
            opacity: 0.95,
          }
        : null
      title.shadow = next.shadowEnabled
        ? {
            offsetX: next.shadowOffsetX,
            offsetY: next.shadowOffsetY,
            softness: next.shadowSoftness,
            color: next.shadowColor,
            opacity: 0.5,
          }
        : null
      await title.sync()
      render()
    })

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
      render()
    }
    observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    return dispose
  } catch (error) {
    dispose()
    throw error
  }
}

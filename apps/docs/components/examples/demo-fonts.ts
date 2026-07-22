import { type FontHandle, loadFont } from '@webgpu-text/font'

const FONT_ASSETS = [
  ['latin', '/fonts/NotoSans-wdth-wght.ttf'],
  ['arabic', '/fonts/NotoSansArabic-wdth-wght.ttf'],
] as const

export interface DemoFonts {
  readonly fonts: ReadonlyMap<string, FontHandle>
  dispose(): void
}

async function fetchFont(url: string, signal: AbortSignal): Promise<FontHandle> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Unable to fetch ${url}: HTTP ${response.status}`)
  const font = await loadFont(await response.arrayBuffer())
  if (!signal.aborted) return font
  font.dispose()
  throw new DOMException('Font loading was cancelled', 'AbortError')
}

export async function loadDemoFonts(signal: AbortSignal): Promise<DemoFonts> {
  const loaded = new Map<string, FontHandle>()
  try {
    for (const [key, url] of FONT_ASSETS) loaded.set(key, await fetchFont(url, signal))
  } catch (error) {
    for (const font of loaded.values()) font.dispose()
    throw error
  }
  return {
    fonts: loaded,
    dispose() {
      for (const font of loaded.values()) font.dispose()
      loaded.clear()
    },
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

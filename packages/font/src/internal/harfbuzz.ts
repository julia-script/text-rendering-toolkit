import {
  __destroyTracked,
  __getRuntime,
  Blob,
  Buffer,
  Face,
  Feature,
  Font,
  shape,
  Variation,
} from './vendor/index.js'

export interface HarfBuzzAxisInfo {
  readonly min: number
  readonly default: number
  readonly max: number
}

export interface HarfBuzzFontExtents {
  readonly ascender: number
  readonly descender: number
  readonly lineGap: number
}

export interface HarfBuzzGlyphExtents {
  readonly xBearing: number
  readonly yBearing: number
  readonly width: number
  readonly height: number
}

export interface HarfBuzzGlyph {
  readonly glyphId: number
  readonly cluster: number
  readonly xAdvance: number
  readonly yAdvance: number
  readonly xOffset: number
  readonly yOffset: number
  readonly flags: number
}

export interface HarfBuzzDrawSink {
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  quadraticTo(controlX: number, controlY: number, x: number, y: number): void
  cubicTo(
    control1X: number,
    control1Y: number,
    control2X: number,
    control2Y: number,
    x: number,
    y: number,
  ): void
  closePath(): void
}

type WasmFunction = (...args: number[]) => number

interface DrawExports {
  readonly hb_draw_funcs_create: WasmFunction
  readonly hb_draw_funcs_destroy: WasmFunction
  readonly hb_draw_funcs_set_close_path_func: WasmFunction
  readonly hb_draw_funcs_set_cubic_to_func: WasmFunction
  readonly hb_draw_funcs_set_line_to_func: WasmFunction
  readonly hb_draw_funcs_set_move_to_func: WasmFunction
  readonly hb_draw_funcs_set_quadratic_to_func: WasmFunction
  readonly hb_font_draw_glyph: WasmFunction
}

interface DrawState {
  readonly fontPointer: number
  readonly callbackPointers: number[]
  drawFunctionsPointer: number
}

const { Module: module, exports: runtimeExports } = __getRuntime()
const wasm = runtimeExports as unknown as DrawExports
const drawSinks = new Map<number, HarfBuzzDrawSink>()

function destroyDrawState(state: DrawState): void {
  drawSinks.delete(state.fontPointer)
  if (state.drawFunctionsPointer) wasm.hb_draw_funcs_destroy(state.drawFunctionsPointer)
  for (const callbackPointer of state.callbackPointers) module.removeFunction(callbackPointer)
  state.callbackPointers.length = 0
  state.drawFunctionsPointer = 0
}

const drawRegistry = new FinalizationRegistry<DrawState>(destroyDrawState)

export class HarfBuzzBlob {
  readonly native: Blob

  constructor(bytes: ArrayBuffer) {
    this.native = new Blob(bytes)
  }

  destroy(): void {
    __destroyTracked(this.native)
  }
}

export class HarfBuzzFace {
  readonly native: Face
  readonly upem: number

  constructor(blob: HarfBuzzBlob) {
    this.native = new Face(blob.native, 0)
    this.upem = this.native.upem
  }

  coverageCount(): number {
    return this.native.collectUnicodes().length
  }

  axisInfos(): Readonly<Record<string, HarfBuzzAxisInfo>> {
    return this.native.getAxisInfos()
  }

  destroy(): void {
    __destroyTracked(this.native)
  }
}

export class HarfBuzzFont {
  readonly native: Font
  readonly #drawState: DrawState

  constructor(face: HarfBuzzFace) {
    this.native = new Font(face.native)
    this.#drawState = {
      fontPointer: this.native.ptr,
      callbackPointers: [],
      drawFunctionsPointer: 0,
    }
    drawRegistry.register(this, this.#drawState, this)
  }

  setScale(x: number, y: number): void {
    this.native.setScale(x, y)
  }

  horizontalExtents(): HarfBuzzFontExtents {
    return this.native.hExtents()
  }

  nominalGlyph(codePoint: number): number | undefined {
    return this.native.nominalGlyph(codePoint)
  }

  setVariations(variations: Readonly<Record<string, number>>): void {
    this.native.setVariations(
      Object.entries(variations).map(([tag, value]) => new Variation(tag, value)),
    )
  }

  glyphExtents(glyphId: number): HarfBuzzGlyphExtents | undefined {
    return this.native.glyphExtents(glyphId)
  }

  drawGlyph(glyphId: number, sink: HarfBuzzDrawSink): void {
    this.#ensureDrawFunctions()
    drawSinks.set(this.native.ptr, sink)
    try {
      wasm.hb_font_draw_glyph(this.native.ptr, glyphId, this.#drawState.drawFunctionsPointer, 0)
    } finally {
      drawSinks.delete(this.native.ptr)
    }
  }

  destroy(): void {
    drawRegistry.unregister(this)
    destroyDrawState(this.#drawState)
    __destroyTracked(this.native)
  }

  #ensureDrawFunctions(): void {
    if (this.#drawState.drawFunctionsPointer) return
    const fontPointer = this.native.ptr
    const callbacks = [
      module.addFunction(
        (_funcs, _data, _state, x, y) => drawSinks.get(fontPointer)?.moveTo(x, y),
        'viiiffi',
      ),
      module.addFunction(
        (_funcs, _data, _state, x, y) => drawSinks.get(fontPointer)?.lineTo(x, y),
        'viiiffi',
      ),
      module.addFunction(
        (_funcs, _data, _state, controlX, controlY, x, y) =>
          drawSinks.get(fontPointer)?.quadraticTo(controlX, controlY, x, y),
        'viiiffffi',
      ),
      module.addFunction(
        (_funcs, _data, _state, control1X, control1Y, control2X, control2Y, x, y) =>
          drawSinks.get(fontPointer)?.cubicTo(control1X, control1Y, control2X, control2Y, x, y),
        'viiiffffffi',
      ),
      module.addFunction(() => drawSinks.get(fontPointer)?.closePath(), 'viiii'),
    ]
    const drawFunctionsPointer = wasm.hb_draw_funcs_create()
    wasm.hb_draw_funcs_set_move_to_func(drawFunctionsPointer, callbacks[0] ?? 0, 0, 0)
    wasm.hb_draw_funcs_set_line_to_func(drawFunctionsPointer, callbacks[1] ?? 0, 0, 0)
    wasm.hb_draw_funcs_set_quadratic_to_func(drawFunctionsPointer, callbacks[2] ?? 0, 0, 0)
    wasm.hb_draw_funcs_set_cubic_to_func(drawFunctionsPointer, callbacks[3] ?? 0, 0, 0)
    wasm.hb_draw_funcs_set_close_path_func(drawFunctionsPointer, callbacks[4] ?? 0, 0, 0)
    this.#drawState.drawFunctionsPointer = drawFunctionsPointer
    this.#drawState.callbackPointers.push(...callbacks)
  }
}

export class HarfBuzzBuffer {
  readonly native = new Buffer()

  shape(
    font: HarfBuzzFont,
    text: string,
    direction: number,
    script: string,
    language: string,
    features: readonly string[],
  ): readonly HarfBuzzGlyph[] {
    this.native.clearContents()
    this.native.setClusterLevel(1)
    this.native.addText(text)
    this.native.setDirection(direction)
    this.native.setScript(script)
    this.native.setLanguage(language)
    const parsedFeatures = features.map((value) => {
      const feature = Feature.fromString(value)
      if (!feature) throw new TypeError(`Invalid OpenType feature: ${value}`)
      return feature
    })
    shape(font.native, this.native, parsedFeatures)
    return this.native.getGlyphInfosAndPositions().map((glyph) => ({
      glyphId: glyph.codepoint,
      cluster: glyph.cluster,
      flags: glyph.flags,
      xAdvance: glyph.xAdvance ?? 0,
      yAdvance: glyph.yAdvance ?? 0,
      xOffset: glyph.xOffset ?? 0,
      yOffset: glyph.yOffset ?? 0,
    }))
  }

  destroy(): void {
    __destroyTracked(this.native)
  }
}

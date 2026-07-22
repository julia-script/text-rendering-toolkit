/**
 * Renderer-neutral font loading, HarfBuzz shaping, font facts, coverage, and
 * lazy numeric glyph outlines.
 *
 * @remarks
 * Everything starts at {@link loadFont}, which turns TTF or OTF bytes into a
 * {@link FontHandle}. From that handle you can read {@link FontFacts}, test
 * coverage with {@link FontHandle.supports}, shape a resolved run with
 * {@link FontHandle.shape}, and pull numeric outlines with
 * {@link FontHandle.getOutline}. Handles own WASM resources, so dispose them
 * when done.
 *
 * The package draws a deliberate boundary: it shapes one already-resolved run
 * at a time and knows nothing about paragraphs. Bidi orchestration, font
 * fallback, line wrapping, SDF generation, atlas management, and rendering all
 * live above it. It also performs no I/O — hand it bytes you have already
 * fetched and decoded.
 *
 * @packageDocumentation
 */

export {
  DisposedFontHandleError,
  InvalidFontError,
  InvalidFontInputError,
  InvalidShapingInputError,
  UnsupportedFontFormatError,
} from './errors.js'
export { loadFont } from './font.js'
export type {
  ColorGlyphLayer,
  ColorGlyphPaint,
  FontDecorationMetrics,
  FontFacts,
  FontHandle,
  FontSource,
  GlyphBounds,
  GlyphOutline,
  RgbaColor,
  ShapedGlyph,
  ShapedRun,
  ShapeInput,
  TextDirection,
  VariationAxis,
  VariationCoordinates,
} from './types.js'
export { OutlineCommand } from './types.js'

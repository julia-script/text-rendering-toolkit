/**
 * Resolved text rendering for Three.js `WebGPURenderer`, using instanced TSL
 * materials and private or explicitly shared renderer resources.
 *
 * @remarks
 * Two exports carry the API. {@link Text} is a `Mesh` that renders a completed
 * `LayoutResult`; {@link TextResources} is an optional application-owned glyph
 * SDF cache and atlas that several `Text` objects can share.
 *
 * The boundary starts *after* font acquisition, itemization, font selection,
 * shaping, and layout: supply a finished layout from `@webgpu-text/layout` plus
 * a map of caller-owned fonts. Nothing here fetches fonts, chooses fallbacks, or
 * measures text, and the supplied layout is never expanded or replaced — so the
 * same result stays usable for selection, carets, and measurement.
 *
 * Rendering is a two-step cycle: assign properties, then await
 * {@link Text.sync}. Syncs in one microtask coalesce into a single commit of the
 * newest state, and a failed sync leaves the last rendered state intact.
 *
 * Requires Three.js `WebGPURenderer`; no legacy-renderer fallback is provided.
 * Workers, atlas eviction, partial uploads, batching, and runtime material
 * switching are outside this package. The application owns the fonts, renderer,
 * canvas, scene, and camera.
 *
 * @packageDocumentation
 */

export {
  DisposedTextError,
  DisposedTextResourcesError,
  InvalidTextInputError,
} from './errors.js'
export { TextResources } from './resources.js'
export { Text } from './text.js'
export type {
  TextColorGlyphLayer,
  TextColorGlyphPaint,
  TextCommittedState,
  TextFont,
  TextGlyphBounds,
  TextGlyphOutline,
  TextMaterial,
  TextOptions,
  TextOptionsBase,
  TextOutline,
  TextResourcesOptions,
  TextRgbaColor,
  TextShadow,
} from './types.js'

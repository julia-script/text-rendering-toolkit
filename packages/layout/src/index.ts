/**
 * Pure, renderer-neutral preparation and layout of raw text or already-resolved
 * shaped runs.
 *
 * @remarks
 * The package exposes three entry points at descending levels of convenience,
 * all reaching the same core:
 *
 * - {@link layoutText} — raw text in, layout out. The usual choice.
 * - {@link prepareText} + {@link layoutPreparedText} — split the font-independent
 *   analysis from the font-dependent layout, so the expensive half can be
 *   cached, persisted, or moved to a worker and reused across font swaps.
 * - {@link layoutResolvedText} — the expert core, for callers running their own
 *   shaping pipeline or supplying exact glyph bounds.
 *
 * {@link getSelectionRects} and {@link deriveTextDecorations} are pure
 * post-layout steps over a {@link LayoutResult}, so selection and styling
 * changes never require reshaping.
 *
 * The application owns every {@link FontHandle}: this package receives an
 * explicit {@link FontRegistry} and never fetches, caches, mutates, or disposes
 * fonts. Its output is a set of glyph *references* — font key, glyph id,
 * variations, scale, position — with no outlines, SDF pixels, atlas slots, or
 * GPU resources, which is what lets Canvas, SVG, WebGPU, or Three.js consume
 * the same result and resolve only the outlines they need.
 *
 * All source ranges are half-open UTF-16 indices, and all coordinates are y-up
 * with the first baseline at the origin before anchoring.
 *
 * @packageDocumentation
 */

export { deriveTextDecorations } from './decorations.js'
export {
  InvalidLayoutInputError,
  TextPreparationError,
  type TextPreparationErrorCode,
} from './errors.js'
export {
  canonicalFixtureJson,
  deriveSelectionRects,
  validateLayoutFixtureDocument,
} from './fixture.js'
export { layoutResolvedText } from './layout.js'
export { prepareText } from './preparation.js'
export { getSelectionRects } from './selection.js'
export { layoutPreparedText, layoutText } from './text.js'
export type {
  CaretStop,
  DecorationBounds,
  DecorationClip,
  DecorationColor,
  DecorationDerivationOptions,
  DecorationKind,
  DecorationSegment,
  DecorationSkipInk,
  DecorationSpan,
  DecorationStyle,
  FixtureClassification,
  FixtureEvidence,
  FixtureEvidenceLayer,
  FontRegistry,
  HorizontalAnchor,
  LayoutAlignment,
  LayoutBounds,
  LayoutDecorationMetricRange,
  LayoutFixtureDocument,
  LayoutLine,
  LayoutOverflowWrap,
  LayoutPolicy,
  LayoutPolicyFixture,
  LayoutResult,
  LayoutSelectionExpectation,
  LayoutWhiteSpace,
  LineBreakKind,
  LineBreakOpportunity,
  ParagraphDirection,
  PositionedGlyph,
  PreparedSegment,
  PreparedText,
  PrepareTextInput,
  ResolvedGlyph,
  ResolvedLayoutInput,
  ResolvedRunMetrics,
  ResolvedShapedRun,
  SelectionQuery,
  SelectionRect,
  TextDecorationResult,
  TextStyle,
  TextStyleRange,
  Utf16Range,
  VerticalAnchor,
} from './types.js'

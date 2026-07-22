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
  FixtureClassification,
  FixtureEvidence,
  FixtureEvidenceLayer,
  FontRegistry,
  HorizontalAnchor,
  LayoutAlignment,
  LayoutBounds,
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
  TextStyle,
  TextStyleRange,
  Utf16Range,
  VerticalAnchor,
} from './types.js'

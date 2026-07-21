export { InvalidLayoutInputError } from './errors.js'
export {
  canonicalFixtureJson,
  deriveSelectionRects,
  validateLayoutFixtureDocument,
} from './fixture.js'
export { layoutResolvedText } from './layout.js'
export { getSelectionRects } from './selection.js'
export type {
  CaretStop,
  FixtureClassification,
  FixtureEvidence,
  FixtureEvidenceLayer,
  HorizontalAnchor,
  LayoutAlignment,
  LayoutBounds,
  LayoutFixtureDocument,
  LayoutLine,
  LayoutOverflowWrap,
  LayoutPolicyFixture,
  LayoutResult,
  LayoutSelectionExpectation,
  LayoutWhiteSpace,
  LineBreakKind,
  PositionedGlyph,
  ResolvedGlyph,
  ResolvedLayoutInput,
  ResolvedRunMetrics,
  ResolvedShapedRun,
  SelectionQuery,
  SelectionRect,
  Utf16Range,
  VerticalAnchor,
} from './types.js'

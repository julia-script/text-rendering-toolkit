import type { FontHandle, TextDirection, VariationCoordinates } from '@webgpu-text/font'

/** Half-open JavaScript UTF-16 source range. */
export interface Utf16Range {
  readonly start: number
  readonly end: number
}

export interface LayoutBounds {
  readonly left: number
  readonly bottom: number
  readonly right: number
  readonly top: number
}

/** Effective metrics in the same layout units as glyph advances and output coordinates. */
export interface ResolvedRunMetrics {
  readonly ascender: number
  readonly descender: number
  readonly lineGap: number
}

export interface ResolvedGlyph extends Utf16Range {
  readonly glyphId: number
  readonly xAdvance: number
  readonly yAdvance: number
  readonly xOffset: number
  readonly yOffset: number
  readonly flags: number
  readonly bounds: LayoutBounds | null
}

export interface ResolvedShapedRun extends Utf16Range {
  readonly direction: TextDirection
  /** Resolved Unicode bidi embedding level; parity must match `direction`. */
  readonly bidiLevel: number
  readonly script: string
  readonly language: string
  readonly styleKey: string
  readonly fontKey: string
  readonly fontSize: number
  /** Multiplier from this run's font-unit outlines to effective layout units. */
  readonly fontUnitScale: number
  readonly metrics: ResolvedRunMetrics
  readonly variations: VariationCoordinates
  readonly glyphs: readonly ResolvedGlyph[]
}

export type LayoutAlignment = 'left' | 'center' | 'right' | 'justify'
export type LayoutWhiteSpace = 'normal' | 'nowrap'
export type LayoutOverflowWrap = 'normal' | 'break-word'
export type HorizontalAnchor = number | 'left' | 'center' | 'right' | `${number}%`
export type VerticalAnchor =
  | number
  | 'top'
  | 'top-baseline'
  | 'top-cap'
  | 'top-ex'
  | 'middle'
  | 'bottom'
  | 'bottom-baseline'
  | `${number}%`

/** Fully selected, itemized, shaped, and scaled input for the pure layout core. */
export interface ResolvedLayoutInput {
  readonly text: string
  readonly paragraphLevel: 0 | 1
  /** Metrics used by an empty line with no intersecting resolved run. */
  readonly defaultMetrics: ResolvedRunMetrics
  readonly maxWidth: number | null
  readonly whiteSpace: LayoutWhiteSpace
  readonly overflowWrap: LayoutOverflowWrap
  readonly textAlign: LayoutAlignment
  readonly textIndent: number
  readonly letterSpacing: number
  readonly lineHeight: number | 'normal'
  readonly anchorX: HorizontalAnchor
  readonly anchorY: VerticalAnchor
  readonly runs: readonly ResolvedShapedRun[]
}

export type ParagraphDirection = 'auto' | 'ltr' | 'rtl'

export interface TextStyle {
  readonly key: string
  readonly fontKeys: readonly string[]
  readonly fontSize: number
  readonly language: string
  readonly features?: readonly string[]
  readonly variations?: VariationCoordinates
}

export interface TextStyleRange extends Utf16Range {
  readonly style: TextStyle
}

export interface LayoutPolicy {
  readonly maxWidth: number | null
  readonly whiteSpace: LayoutWhiteSpace
  readonly overflowWrap: LayoutOverflowWrap
  readonly textAlign: LayoutAlignment
  readonly textIndent: number
  readonly letterSpacing: number
  readonly lineHeight: number | 'normal'
  readonly anchorX: HorizontalAnchor
  readonly anchorY: VerticalAnchor
}

export interface PrepareTextInput {
  readonly text: string
  readonly paragraphDirection?: ParagraphDirection
  readonly style: TextStyle
  readonly styleRanges?: readonly TextStyleRange[]
  readonly layout?: Partial<LayoutPolicy>
}

export interface PreparedSegment extends Utf16Range {
  readonly paragraphLevel: 0 | 1
  readonly bidiLevel: number
  readonly direction: 'ltr' | 'rtl'
  readonly script: string
  readonly styleKey: string
  readonly fontKeys: readonly string[]
  readonly fontSize: number
  readonly language: string
  readonly features: readonly string[]
  readonly variations: VariationCoordinates
}

export interface PreparedText {
  readonly schemaVersion: 1
  readonly text: string
  readonly paragraphDirection: ParagraphDirection
  readonly defaultStyle: TextStyle
  readonly layout: LayoutPolicy
  readonly segments: readonly PreparedSegment[]
}

export type FontRegistry = ReadonlyMap<string, FontHandle>

export interface PositionedGlyph extends Utf16Range {
  readonly fontKey: string
  readonly styleKey: string
  readonly glyphId: number
  readonly variations: VariationCoordinates
  /** Multiplier from this glyph's font-unit outline to effective layout units. */
  readonly fontUnitScale: number
  readonly lineIndex: number
  readonly x: number
  readonly y: number
  readonly xAdvance: number
  readonly yAdvance: number
  readonly xOffset: number
  readonly yOffset: number
  readonly bounds: LayoutBounds | null
}

export type LineBreakKind = 'none' | 'hard' | 'soft'

export interface LayoutLine extends Utf16Range {
  readonly glyphStart: number
  readonly glyphEnd: number
  readonly baseline: number
  readonly left: number
  readonly right: number
  readonly bottom: number
  readonly top: number
  readonly breakAfter: LineBreakKind
}

export interface CaretStop {
  readonly offset: number
  readonly lineIndex: number
  readonly x: number
  readonly bottom: number
  readonly top: number
}

export interface SelectionQuery {
  readonly start: number
  readonly end: number
}

export interface SelectionRect extends LayoutBounds {
  readonly lineIndex: number
}

export interface LayoutResult {
  readonly sourceLengthUtf16: number
  readonly fontKeys: readonly string[]
  readonly glyphs: readonly PositionedGlyph[]
  readonly lines: readonly LayoutLine[]
  readonly carets: readonly CaretStop[]
  readonly blockBounds: LayoutBounds
  readonly visibleBounds: LayoutBounds | null
}

export type FixtureClassification = 'preserve' | 'intentional-change' | 'defer'
export type FixtureEvidenceLayer = 'synthetic' | 'troika-reference' | 'font-integration'

export interface FixtureEvidence {
  readonly layer: FixtureEvidenceLayer
  readonly source: string
  readonly integrity: string
}

export interface LayoutSelectionExpectation {
  readonly query: SelectionQuery
  readonly rects: readonly SelectionRect[]
}

export interface LayoutPolicyFixture {
  readonly id: string
  readonly intent: string
  readonly tags: readonly string[]
  readonly classification: FixtureClassification
  readonly rationale: string
  readonly evidence: FixtureEvidence
  readonly input: ResolvedLayoutInput
  readonly expected: LayoutResult
  readonly selections: readonly LayoutSelectionExpectation[]
}

export interface LayoutFixtureDocument {
  readonly schemaVersion: 1
  readonly numericPrecision: number
  readonly fixtures: readonly LayoutPolicyFixture[]
}

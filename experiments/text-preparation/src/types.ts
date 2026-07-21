import type { FontHandle, VariationCoordinates } from '@webgpu-text/font'
import type {
  HorizontalAnchor,
  LayoutAlignment,
  LayoutOverflowWrap,
  LayoutResult,
  LayoutWhiteSpace,
  ResolvedLayoutInput,
  ResolvedShapedRun,
  VerticalAnchor,
} from '@webgpu-text/layout'

export type ParagraphDirection = 'auto' | 'ltr' | 'rtl'

export interface TextStyle {
  readonly key: string
  readonly fontKeys: readonly string[]
  readonly fontSize: number
  readonly language: string
  readonly features?: readonly string[]
  readonly variations?: VariationCoordinates
}

export interface TextStyleRange {
  readonly start: number
  readonly end: number
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

export interface PreparedSegment {
  readonly start: number
  readonly end: number
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
  readonly paragraphLevel: 0 | 1
  readonly defaultStyle: TextStyle
  readonly layout: LayoutPolicy
  readonly segments: readonly PreparedSegment[]
}

export interface ResolvedText {
  readonly input: ResolvedLayoutInput
  readonly runs: readonly ResolvedShapedRun[]
}

export interface CompletedText extends ResolvedText {
  readonly layout: LayoutResult
}

export type FontRegistry = ReadonlyMap<string, FontHandle>

export interface PreparationEvidence {
  readonly layer: 'synthetic' | 'font-integration' | 'troika-reference'
  readonly source: string
  readonly integrity: string
}

export interface PreparationExpectation {
  readonly preparedSegments?: readonly PreparedSegment[]
  readonly resolved?: {
    readonly fontKeys: readonly string[]
    readonly runRanges: readonly {
      readonly start: number
      readonly end: number
      readonly fontKey: string
      readonly styleKey: string
    }[]
  }
  readonly layout?: {
    readonly sourceLengthUtf16: number
    readonly lineCount: number
    readonly minimumGlyphCount: number
    readonly fontKeys: readonly string[]
  }
  readonly error?: {
    readonly code: 'invalid-input' | 'missing-font' | 'missing-coverage'
    readonly start?: number
    readonly end?: number
    readonly attemptedFontKeys?: readonly string[]
  }
}

export interface PreparationFixture {
  readonly id: string
  readonly intent: string
  readonly tags: readonly string[]
  readonly classification: 'preserve' | 'intentional-change' | 'defer'
  readonly rationale: string
  readonly evidence: PreparationEvidence
  readonly input: PrepareTextInput
  readonly expected: PreparationExpectation
}

export interface PreparationFixtureDocument {
  readonly schemaVersion: 1
  readonly unicodeVersion: string
  readonly bidiRevision: string
  readonly fontManifest: {
    readonly file: string
    readonly sha256: string
  }
  readonly fixtures: readonly PreparationFixture[]
}

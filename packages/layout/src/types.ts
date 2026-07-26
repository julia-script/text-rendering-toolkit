import type {
  ColorGlyphPaint,
  FontDecorationMetrics,
  FontHandle,
  TextDirection,
  VariationCoordinates,
} from '@text-rendering-toolkit/font'

/**
 * Half-open JavaScript UTF-16 source range: `start` inclusive, `end` exclusive.
 *
 * @remarks
 * Every source range in this package is UTF-16 indices into the original
 * string, exactly as `String#slice` uses them — not code points, not graphemes.
 * That means an astral character such as an emoji spans two units, so ranges
 * are expected to fall on grapheme boundaries; a range that splits a surrogate
 * pair or a grapheme cluster is rejected rather than silently rounded.
 */
export interface Utf16Range {
  /** Inclusive UTF-16 start index. */
  readonly start: number
  /** Exclusive UTF-16 end index. */
  readonly end: number
}

/**
 * An axis-aligned rectangle in layout coordinates.
 *
 * @remarks
 * The coordinate system is **y-up**, with the first line's baseline at the
 * origin before anchoring is applied — so `top` is greater than `bottom`, and
 * descenders sit at negative y. This matches the font package's outline space
 * and typical GPU conventions, but is upside-down relative to DOM and Canvas
 * 2D; flip the sign of y when handing these to a y-down renderer.
 */
export interface LayoutBounds {
  /** Leftmost edge. */
  readonly left: number
  /** Lowest edge; below the baseline is negative. */
  readonly bottom: number
  /** Rightmost edge. */
  readonly right: number
  /** Highest edge. */
  readonly top: number
}

/**
 * A legal UTF-16 boundary after which layout may, or must, start a new line.
 *
 * @remarks
 * Produced by {@link prepareText} from the Unicode line-breaking algorithm, and
 * accepted by {@link layoutResolvedText} for expert callers who run their own
 * segmentation. `required` distinguishes the two classes that behave very
 * differently under `whiteSpace: 'nowrap'`: an optional opportunity is a place
 * wrapping *may* occur and is ignored when wrapping is off, while a required
 * one is a hard break from the source text (a newline) and splits the line
 * regardless.
 *
 * A position must land on a grapheme and shaped-cluster boundary; one that
 * would split a cluster is rejected.
 */
export interface LineBreakOpportunity {
  /** UTF-16 offset at which the following line would begin. */
  readonly position: number
  /** `true` for a mandatory break from the source; `false` for a wrap candidate. */
  readonly required: boolean
}

/**
 * Effective metrics in the same layout units as glyph advances and output
 * coordinates.
 *
 * @remarks
 * Already scaled — unlike the font package's `FontFacts`, which are in font
 * units. Multiply each font fact by `fontSize / unitsPerEm` exactly once when
 * building these; the layout core never applies that scale itself.
 */
export interface ResolvedRunMetrics {
  /** Scaled ascent above the baseline, positive. */
  readonly ascender: number
  /** Scaled descent below the baseline, negative. */
  readonly descender: number
  /** Scaled extra leading requested by the font. */
  readonly lineGap: number
  /** Scaled underline and strikethrough placement for this run. */
  readonly decorationMetrics: FontDecorationMetrics
}

/**
 * One shaped, already-scaled glyph handed to the resolved layout core.
 *
 * @remarks
 * The `start`/`end` range is the source cluster this glyph belongs to, carried
 * over from shaping. Several glyphs may share one range (a decomposed cluster)
 * and one glyph may span several characters (a ligature); layout relies on
 * these ranges for caret and selection geometry, so they must stay faithful to
 * the shaper's output.
 */
export interface ResolvedGlyph extends Utf16Range {
  /** Font-internal glyph index, resolved lazily against the caller's font registry. */
  readonly glyphId: number
  /** Scaled horizontal advance in layout units. */
  readonly xAdvance: number
  /** Scaled vertical advance; zero for horizontal runs. */
  readonly yAdvance: number
  /** Scaled horizontal draw-time nudge. */
  readonly xOffset: number
  /** Scaled vertical draw-time nudge. */
  readonly yOffset: number
  /** Raw shaper glyph flags, passed through unchanged. */
  readonly flags: number
  /**
   * Exact scaled ink bounds, or `null` to skip outline work.
   *
   * @remarks
   * `null` is the normal choice and what the raw-text path always produces: it
   * avoids extracting outlines during layout, at the cost of a `null`
   * {@link LayoutResult.visibleBounds} and continuous (non-skip-ink)
   * decorations. Supply real bounds only when you already have them.
   */
  readonly bounds: LayoutBounds | null
}

/**
 * A contiguous run of text already itemized, font-selected, shaped, and scaled
 * — the unit of input to {@link layoutResolvedText}.
 *
 * @remarks
 * Runs must tile the source text in logical order without overlapping. Each one
 * carries its own metrics and scale, which is what lets a single line mix fonts
 * and sizes.
 */
export interface ResolvedShapedRun extends Utf16Range {
  /** Direction this run was shaped with. */
  readonly direction: TextDirection
  /** Resolved Unicode bidi embedding level; parity must match `direction`. */
  readonly bidiLevel: number
  /** Four-letter ISO 15924 script code. */
  readonly script: string
  /** BCP 47 language tag. */
  readonly language: string
  /** Caller-defined style identifier, passed through to positioned glyphs. */
  readonly styleKey: string
  /** Key into the caller's {@link FontRegistry} for the font this run was shaped with. */
  readonly fontKey: string
  /** Font size in layout units. */
  readonly fontSize: number
  /** Multiplier from this run's font-unit outlines to effective layout units. */
  readonly fontUnitScale: number
  /** Scaled vertical and decoration metrics for this run. */
  readonly metrics: ResolvedRunMetrics
  /** Variation coordinates this run was shaped at; needed to re-fetch matching outlines. */
  readonly variations: VariationCoordinates
  /** The run's shaped glyphs, in the shaper's direction-local order. */
  readonly glyphs: readonly ResolvedGlyph[]
}

/**
 * Horizontal alignment of each line within the block.
 *
 * @remarks
 * `justify` stretches eligible whitespace to fill `maxWidth`, and leaves the
 * last line of each paragraph aligned to the start edge as usual. With
 * `maxWidth: null` there is nothing to justify against, so it behaves as
 * start-aligned.
 */
export type LayoutAlignment = 'left' | 'center' | 'right' | 'justify'

/**
 * Whether soft wrap opportunities are honored.
 *
 * @remarks
 * `nowrap` suppresses optional opportunities but still breaks at required ones,
 * so hard newlines in the source survive. Lines may then exceed `maxWidth` —
 * clip or scroll downstream if that matters.
 */
export type LayoutWhiteSpace = 'normal' | 'nowrap'

/**
 * What to do with a word too long to fit its line on its own.
 *
 * @remarks
 * `normal` lets it overflow. `break-word` permits an emergency break at a
 * grapheme boundary inside the word, used only after every ordinary opportunity
 * has failed. Emergency breaks are still cluster-safe: they never split a
 * grapheme or a shaped ligature.
 */
export type LayoutOverflowWrap = 'normal' | 'break-word'

/**
 * Horizontal origin of the laid-out block.
 *
 * @remarks
 * A number is an offset in layout units, a percentage is a fraction of the
 * block width, and the keywords are shorthands for `0%`, `50%`, and `100%`. The
 * anchor shifts the whole result so that the named point lands on x = 0, which
 * is what lets a renderer position text without measuring it first.
 */
export type HorizontalAnchor = number | 'left' | 'center' | 'right' | `${number}%`

/**
 * Vertical origin of the laid-out block.
 *
 * @remarks
 * Works like {@link HorizontalAnchor}, with extra typographic keywords:
 * `top-baseline` puts the first line's baseline at the origin (the default and
 * usually what you want for text that must align with other text), while
 * `top-cap` and `top-ex` use the cap height and x-height of the first line.
 * `bottom-baseline` uses the last line's baseline.
 */
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

/**
 * Fully selected, itemized, shaped, and scaled input for the pure layout core.
 *
 * @remarks
 * This is the expert entry point. Every measurement here — advances, offsets,
 * metrics, `maxWidth`, `textIndent`, `letterSpacing`, and an explicit
 * `lineHeight` — must already be in one consistent layout-unit coordinate
 * system. {@link layoutResolvedText} does no scaling of its own.
 *
 * Most callers should use {@link layoutText} or {@link layoutPreparedText}
 * instead, which perform bidi, itemization, font fallback, shaping, and scaling
 * and then call this core.
 *
 * @see {@link layoutResolvedText}
 */
export interface ResolvedLayoutInput {
  /** The complete source text the runs refer into. */
  readonly text: string
  /** Base paragraph embedding level: `0` for LTR, `1` for RTL. */
  readonly paragraphLevel: 0 | 1
  /** Metrics used by an empty line with no intersecting resolved run. */
  readonly defaultMetrics: ResolvedRunMetrics
  /** Wrap width in layout units, or `null` for unbounded single-line layout. */
  readonly maxWidth: number | null
  /** Whether soft wrapping is enabled. */
  readonly whiteSpace: LayoutWhiteSpace
  /** Emergency breaking policy for over-long words. */
  readonly overflowWrap: LayoutOverflowWrap
  /** Horizontal alignment of lines within the block. */
  readonly textAlign: LayoutAlignment
  /** First-line indent in layout units. */
  readonly textIndent: number
  /** Extra spacing added after each cluster, in layout units. */
  readonly letterSpacing: number
  /** Explicit line height in layout units, or `'normal'` to derive it from run metrics. */
  readonly lineHeight: number | 'normal'
  /** Horizontal anchor point of the block. */
  readonly anchorX: HorizontalAnchor
  /** Vertical anchor point of the block. */
  readonly anchorY: VerticalAnchor
  /** Shaped runs tiling `text` in logical order. */
  readonly runs: readonly ResolvedShapedRun[]
  /** Optional explicit Unicode opportunities. Omission preserves legacy whitespace wrapping. */
  readonly breakOpportunities?: readonly LineBreakOpportunity[]
}

/**
 * Base direction for a paragraph.
 *
 * @remarks
 * `'auto'` applies the Unicode bidi algorithm's first-strong heuristic: the
 * first strongly-directional character decides. Force `'ltr'` or `'rtl'` when
 * the surrounding UI already knows the direction, since a paragraph opening
 * with punctuation or digits gives the heuristic nothing to work with.
 */
export type ParagraphDirection = 'auto' | 'ltr' | 'rtl'

/**
 * A named text style: which fonts to try, at what size, and with what OpenType
 * settings.
 *
 * @remarks
 * `fontKeys` is an ordered fallback chain of keys into the caller's
 * {@link FontRegistry}. For each grapheme, the first font covering *every*
 * character in it wins; whole-grapheme coverage is the rule, so a base plus
 * combining mark never splits across two fonts. If no listed font covers a
 * grapheme, preparation fails with a `missing-coverage`
 * {@link TextPreparationError} rather than rendering tofu — list a broad
 * last-resort font if you would rather degrade than throw.
 */
export interface TextStyle {
  /** Caller-defined identifier, echoed onto every positioned glyph as `styleKey`. */
  readonly key: string
  /** Ordered font fallback chain, as keys into the {@link FontRegistry}. */
  readonly fontKeys: readonly string[]
  /** Font size in layout units. */
  readonly fontSize: number
  /** BCP 47 language tag, or `'und'` when unknown. */
  readonly language: string
  /**
   * OpenType feature settings in HarfBuzz syntax, such as `liga=1`.
   *
   * @defaultValue `[]`
   */
  readonly features?: readonly string[]
  /**
   * Variable-font coordinates, such as `{ wght: 700 }`.
   *
   * @defaultValue `{}`
   */
  readonly variations?: VariationCoordinates
}

/**
 * A style applied to one source range, overriding the default style there.
 *
 * @remarks
 * Boundaries must fall on grapheme boundaries. Ranges may not overlap, and any
 * source not covered by a range uses {@link PrepareTextInput.style}.
 */
export interface TextStyleRange extends Utf16Range {
  /** Style to apply across this range. */
  readonly style: TextStyle
}

/**
 * The complete set of wrapping, alignment, spacing, and anchoring decisions for
 * a layout.
 *
 * @remarks
 * {@link PrepareTextInput.layout} accepts a partial version of this and fills
 * every omitted field with its default: no wrap width, `'normal'` white space
 * and overflow wrap, `'left'` alignment, zero indent and letter spacing,
 * `'normal'` line height, and numeric `0` for both anchors.
 */
export interface LayoutPolicy {
  /** Wrap width in layout units, or `null` for unbounded. */
  readonly maxWidth: number | null
  /** Whether soft wrapping is enabled. */
  readonly whiteSpace: LayoutWhiteSpace
  /** Emergency breaking policy for over-long words. */
  readonly overflowWrap: LayoutOverflowWrap
  /** Horizontal alignment of lines within the block. */
  readonly textAlign: LayoutAlignment
  /** First-line indent in layout units. */
  readonly textIndent: number
  /** Extra spacing added after each cluster, in layout units. */
  readonly letterSpacing: number
  /** Explicit line height in layout units, or `'normal'` to derive from metrics. */
  readonly lineHeight: number | 'normal'
  /** Horizontal anchor point of the block. */
  readonly anchorX: HorizontalAnchor
  /** Vertical anchor point of the block. */
  readonly anchorY: VerticalAnchor
}

/**
 * Raw-text input to {@link prepareText} and {@link layoutText}.
 *
 * @remarks
 * This is the ordinary entry point: hand it a plain string plus a style, and
 * the package handles bidi, script itemization, grapheme segmentation, font
 * fallback, and line-break analysis.
 *
 * @example
 * ```typescript
 * const input = {
 *   text: 'Hello مرحبا',
 *   style: { key: 'body', fontKeys: ['latin', 'arabic'], fontSize: 24, language: 'und' },
 *   layout: { maxWidth: 320 },
 * }
 * ```
 */
export interface PrepareTextInput {
  /** The text to lay out. Must be well-formed UTF-16 with no unpaired surrogates. */
  readonly text: string
  /**
   * Base paragraph direction.
   *
   * @defaultValue `'auto'` — first-strong detection.
   */
  readonly paragraphDirection?: ParagraphDirection
  /** Style for any source not covered by `styleRanges`. */
  readonly style: TextStyle
  /**
   * Per-range style overrides, on grapheme boundaries and non-overlapping.
   *
   * @defaultValue `[]`
   */
  readonly styleRanges?: readonly TextStyleRange[]
  /**
   * Wrapping, alignment, and anchoring policy; omitted fields take their
   * {@link LayoutPolicy} defaults.
   *
   * @defaultValue `{}`
   */
  readonly layout?: Partial<LayoutPolicy>
}

/**
 * One maximal source span sharing a single bidi level, script, and style — the
 * unit produced by preparation and later handed to the shaper.
 *
 * @remarks
 * Segments cover all non-hard-break source in logical order without
 * overlapping; hard break characters themselves are deliberately excluded,
 * since they produce no glyphs. Adjacent graphemes are merged whenever every
 * shaping-relevant property matches, so segment count reflects genuine style
 * and script changes rather than character count.
 */
export interface PreparedSegment extends Utf16Range {
  /** Base paragraph level this segment belongs to. */
  readonly paragraphLevel: 0 | 1
  /** Resolved Unicode bidi embedding level. */
  readonly bidiLevel: number
  /** Direction implied by `bidiLevel` parity. */
  readonly direction: 'ltr' | 'rtl'
  /** Four-letter ISO 15924 script code, after inherited/common adoption. */
  readonly script: string
  /** Key of the style in effect. */
  readonly styleKey: string
  /** Ordered font fallback chain from the effective style. */
  readonly fontKeys: readonly string[]
  /** Font size in layout units. */
  readonly fontSize: number
  /** BCP 47 language tag. */
  readonly language: string
  /** Resolved OpenType features; empty when the style specified none. */
  readonly features: readonly string[]
  /** Resolved variation coordinates; empty when the style specified none. */
  readonly variations: VariationCoordinates
}

/**
 * The deeply frozen, serializable result of {@link prepareText} — everything
 * derivable from text alone, before any font is consulted.
 *
 * @remarks
 * Preparation is the expensive, font-independent half of layout: bidi
 * resolution, grapheme segmentation, script itemization, style intersection,
 * and Unicode line-break analysis. Because the result is plain JSON, it can be
 * cached, persisted, or sent across a worker boundary and later re-laid-out
 * with {@link layoutPreparedText} against a structurally equivalent registry.
 *
 * Reuse it whenever the text and style are stable but something font-side or
 * purely visual changed. Note that `layout` policy is captured *here*, so
 * changing `maxWidth` does require re-preparing.
 *
 * @example
 * Prepare once, lay out against two different font registries.
 * ```typescript
 * const prepared = prepareText(input)
 * const draft = layoutPreparedText(prepared, draftFonts)
 * const final = layoutPreparedText(prepared, productionFonts)
 * ```
 */
export interface PreparedText {
  /** Schema version of this record; currently always `2`. */
  readonly schemaVersion: 2
  /** The original source text. */
  readonly text: string
  /** Paragraph direction as requested, before resolution. */
  readonly paragraphDirection: ParagraphDirection
  /** The default style, with optional fields filled in. */
  readonly defaultStyle: TextStyle
  /** The fully resolved layout policy. */
  readonly layout: LayoutPolicy
  /** Itemized segments covering all non-hard-break source. */
  readonly segments: readonly PreparedSegment[]
  /** Ordered Unicode line-break opportunities for the whole text. */
  readonly breakOpportunities: readonly LineBreakOpportunity[]
}

/**
 * The caller's map from font key to loaded {@link FontHandle}.
 *
 * @remarks
 * The application owns every handle in it: this package never fetches,
 * discovers, caches globally, mutates, or disposes fonts, and holds no
 * reference past the call. Keys are arbitrary caller-chosen strings, matched
 * against {@link TextStyle.fontKeys}, and appear on every
 * {@link PositionedGlyph} so a renderer can resolve outlines later.
 *
 * A key named by a style but absent here raises a `missing-font`
 * {@link TextPreparationError}.
 */
export type FontRegistry = ReadonlyMap<string, FontHandle>

/**
 * A glyph placed at a final position, carrying everything a renderer needs to
 * draw it — but no outline.
 *
 * @remarks
 * Deliberately a *reference* rather than geometry. To draw one, look up
 * `fontKey` in your registry, call `getOutline(glyphId, variations)`, and scale
 * the font-unit result by `fontUnitScale` before translating to `x`/`y`. That
 * indirection is what keeps this package renderer-neutral and lets outlines be
 * resolved lazily — or never, for glyphs scrolled out of view.
 *
 * `x` and `y` are the pen position on the baseline, with anchoring already
 * applied; `xOffset`/`yOffset` are the shaper's draw-time nudges, which the
 * renderer adds when placing the outline but which do not move the pen.
 *
 * @example
 * Resolve outlines only for the glyphs you actually draw.
 * ```typescript
 * for (const glyph of result.glyphs) {
 *   const font = fonts.get(glyph.fontKey)!
 *   const outline = font.getOutline(glyph.glyphId, glyph.variations)
 *   drawOutline(outline, {
 *     scale: glyph.fontUnitScale,
 *     x: glyph.x + glyph.xOffset,
 *     y: glyph.y + glyph.yOffset,
 *   })
 * }
 * ```
 */
export interface PositionedGlyph extends Utf16Range {
  /** Registry key of the font this glyph came from. */
  readonly fontKey: string
  /** Key of the style in effect for this glyph. */
  readonly styleKey: string
  /** Font-internal glyph index. */
  readonly glyphId: number
  /** Variation coordinates to request the matching outline at. */
  readonly variations: VariationCoordinates
  /** Multiplier from this glyph's font-unit outline to effective layout units. */
  readonly fontUnitScale: number
  /** Index into {@link LayoutResult.lines} of the line holding this glyph. */
  readonly lineIndex: number
  /** Final pen x on the baseline, after alignment and anchoring. */
  readonly x: number
  /** Final baseline y, after anchoring. */
  readonly y: number
  /** Horizontal advance in layout units. */
  readonly xAdvance: number
  /** Vertical advance in layout units. */
  readonly yAdvance: number
  /** Draw-time horizontal nudge; add to `x` when placing, do not advance the pen. */
  readonly xOffset: number
  /** Draw-time vertical nudge; add to `y` when placing. */
  readonly yOffset: number
  /** Exact ink bounds when the caller supplied them, otherwise `null`. */
  readonly bounds: LayoutBounds | null
}

/**
 * Why a line ended: `'hard'` at a source newline, `'soft'` at a wrap, `'none'`
 * for the final line.
 */
export type LineBreakKind = 'none' | 'hard' | 'soft'

/**
 * One laid-out line: its source range, its slice of the glyph array, and its
 * vertical box.
 *
 * @remarks
 * `glyphStart`/`glyphEnd` index into {@link LayoutResult.glyphs}, which is
 * ordered by line, so `glyphs.slice(line.glyphStart, line.glyphEnd)` is exactly
 * this line's glyphs. Coordinates are y-up with anchoring applied, and
 * `baseline` is where text sits — use it, not `bottom`, to align decorations or
 * inline objects.
 */
export interface LayoutLine extends Utf16Range {
  /** Inclusive start index into {@link LayoutResult.glyphs}. */
  readonly glyphStart: number
  /** Exclusive end index into {@link LayoutResult.glyphs}. */
  readonly glyphEnd: number
  /** Baseline y for this line. */
  readonly baseline: number
  /** Left edge after alignment and indent. */
  readonly left: number
  /** Right edge of the line's content. */
  readonly right: number
  /** Bottom of the line box. */
  readonly bottom: number
  /** Top of the line box. */
  readonly top: number
  /** What terminated this line. */
  readonly breakAfter: LineBreakKind
}

/**
 * A legal caret position: one insertion point, with the vertical extent to draw
 * a cursor at.
 *
 * @remarks
 * Stops are emitted at grapheme boundaries, not every UTF-16 index, so moving
 * through them steps over emoji and combining sequences correctly. In
 * bidirectional text, consecutive `offset` values are not necessarily
 * left-to-right on screen — `x` is the visual position and can jump at a
 * direction boundary.
 *
 * {@link getSelectionRects} builds selection geometry from these, so a result
 * carrying only `carets` and `sourceLengthUtf16` is enough for selection.
 */
export interface CaretStop {
  /** UTF-16 source offset of this insertion point. */
  readonly offset: number
  /** Index of the line the caret sits on. */
  readonly lineIndex: number
  /** Visual x of the caret. */
  readonly x: number
  /** Bottom of the caret's vertical extent. */
  readonly bottom: number
  /** Top of the caret's vertical extent. */
  readonly top: number
}

/**
 * A source range to build selection geometry for.
 *
 * @remarks
 * Order-insensitive and forgiving: `start` and `end` are sorted, then clamped
 * to the text, so an anchor-and-focus pair from a UI can be passed as-is. An
 * empty or collapsed range yields no rectangles.
 */
export interface SelectionQuery {
  /** One end of the selection, in UTF-16 offsets. */
  readonly start: number
  /** The other end; may be less than `start`. */
  readonly end: number
}

/**
 * One selection highlight rectangle, confined to a single line.
 *
 * @remarks
 * A selection spanning lines or bidi direction changes produces several of
 * these; adjacent rectangles on the same line are merged, so what you get is
 * the minimal set covering the range.
 */
export interface SelectionRect extends LayoutBounds {
  /** Index of the line this rectangle belongs to. */
  readonly lineIndex: number
}

/**
 * Decoration metrics that apply across one source range, in layout units.
 *
 * @remarks
 * A run of text in a single font contributes one range. Mixed fonts produce
 * several, which is how {@link deriveTextDecorations} keeps an underline at a
 * consistent depth instead of stepping at every fallback boundary.
 */
export interface LayoutDecorationMetricRange extends Utf16Range, FontDecorationMetrics {}

/**
 * The complete renderer-neutral handoff: positioned glyph references, lines,
 * carets, bounds, and stable font and style keys.
 *
 * @remarks
 * Contains no outlines, SDF pixels, atlas slots, GPU resources, or renderer
 * objects, so the same result can drive Canvas, SVG, WebGPU, or Three.js. Every
 * coordinate is y-up with anchoring already applied.
 *
 * @example
 * ```typescript
 * const result = layoutText(input, fonts)
 * result.lines.length // 4 when the text wraps to four lines
 * result.blockBounds // { left: 0, bottom: -17.7, right: 320, top: 33 }
 * ```
 */
export interface LayoutResult {
  /** Length of the source text in UTF-16 units; the clamp bound for queries. */
  readonly sourceLengthUtf16: number
  /** Distinct font keys used, in first-use order — what a renderer must resolve. */
  readonly fontKeys: readonly string[]
  /** Every positioned glyph, ordered by line then logical position. */
  readonly glyphs: readonly PositionedGlyph[]
  /** The laid-out lines in visual top-to-bottom order. */
  readonly lines: readonly LayoutLine[]
  /** Caret stops at grapheme boundaries, for cursors and selection. */
  readonly carets: readonly CaretStop[]
  /** Decoration metrics for empty text or source gaps with no resolved run. */
  readonly defaultDecorationMetrics: FontDecorationMetrics
  /** Per-range decoration metrics covering the resolved runs. */
  readonly decorationMetrics: readonly LayoutDecorationMetricRange[]
  /**
   * The block's layout box, including empty space from alignment.
   *
   * @remarks
   * With a `maxWidth` set, `right` reflects that width rather than the longest
   * line — this is the box to size a container with. For the tight ink box, use
   * {@link LayoutResult.visibleBounds}.
   */
  readonly blockBounds: LayoutBounds
  /**
   * Tight bounds of actual glyph ink, or `null` when no glyph carried bounds.
   *
   * @remarks
   * `null` is normal and expected on the raw-text path, which keeps glyph
   * bounds `null` to avoid outline work. Fall back to
   * {@link LayoutResult.blockBounds}, or supply exact bounds through
   * {@link layoutResolvedText} when you need a tight box.
   */
  readonly visibleBounds: LayoutBounds | null
}

/**
 * Decoration paint: an RGBA byte color, or `'foreground'` to defer to the
 * renderer's current text color.
 */
export type DecorationColor = ColorGlyphPaint

/** Which decoration line to draw. */
export type DecorationKind = 'underline' | 'strikethrough'

/**
 * Line pattern.
 *
 * @remarks
 * Supported combinations are solid, dotted, and wavy underline plus solid
 * strikethrough.
 */
export type DecorationStyle = 'solid' | 'dotted' | 'wavy'

/**
 * Whether the line is interrupted where glyph ink crosses it.
 *
 * @remarks
 * `'auto'` is opt-in and uses only already-positioned glyph bounds — so it has
 * no effect on the raw-text path, where bounds are `null` and the line stays
 * continuous. No outlines are ever requested to compute it. A renderer that
 * owns exact outlines or SDF coverage may refine the retained `'auto'` policy
 * itself.
 */
export type DecorationSkipInk = 'none' | 'auto'

/**
 * Appearance-only source range applied after text preparation and layout.
 *
 * @remarks
 * Spans are independent and may overlap; each resolves on its own. Because
 * decoration derivation is a pure post-layout step, changing color, style,
 * skip-ink, or metrics reuses the same {@link PreparedText} and
 * {@link LayoutResult} with no reshaping.
 */
export interface DecorationSpan extends Utf16Range {
  /** Underline or strikethrough. */
  readonly kind: DecorationKind
  /** Line pattern. */
  readonly style: DecorationStyle
  /** Paint for this span. */
  readonly color: DecorationColor
  /**
   * Line thickness in layout units, or `'auto'` to use font metrics.
   *
   * @remarks
   * `'auto'` takes the first effective retained font metrics across the whole
   * span, so a color-emoji or other fallback font mid-span does not introduce a
   * vertical step. A finite number overrides that directly.
   *
   * @defaultValue `'auto'`
   */
  readonly thickness?: number | 'auto'
  /**
   * Baseline-relative offset in layout units, or `'auto'` to use font metrics.
   *
   * @defaultValue `'auto'`
   */
  readonly offset?: number | 'auto'
  /**
   * Whether to interrupt the line at glyph ink.
   *
   * @defaultValue `'none'`
   */
  readonly skipInk?: DecorationSkipInk
}

/** Optional horizontal clip in layout coordinates. */
export interface DecorationClip {
  /** Left clip edge; segment portions left of this are removed. */
  readonly left: number
  /** Right clip edge; segment portions right of this are removed. */
  readonly right: number
}

/** Options for {@link deriveTextDecorations}. */
export interface DecorationDerivationOptions {
  /**
   * Restrict output to a horizontal window, for viewport culling.
   *
   * @remarks
   * Clipping preserves pattern phase: a dotted or wavy line resumes where it
   * would have been had the removed portion been drawn, so scrolling does not
   * make the pattern crawl.
   */
  readonly clip?: DecorationClip
}

/**
 * Renderer-neutral resolved line or pattern fragment.
 *
 * @remarks
 * Analytic, not tessellated: a description a renderer turns into geometry
 * however it likes. One span produces several segments when it crosses lines,
 * bidi boundaries, or skip-ink gaps.
 *
 * Fields carry style-specific meanings. For `'dotted'`, `thickness` is the dot
 * diameter and `wavelength` the dot-center spacing. For `'wavy'`, `amplitude`,
 * `wavelength`, and `phase` describe the wave. For `'solid'`, `amplitude` and
 * `wavelength` are zero.
 */
export interface DecorationSegment {
  /** Inclusive UTF-16 start of the source this fragment covers. */
  readonly sourceStart: number
  /** Exclusive UTF-16 end of the source this fragment covers. */
  readonly sourceEnd: number
  /** Index of the line this fragment sits on. */
  readonly lineIndex: number
  /** Underline or strikethrough. */
  readonly kind: DecorationKind
  /** Line pattern. */
  readonly style: DecorationStyle
  /** Resolved paint. */
  readonly color: DecorationColor
  /** Left end of the fragment in layout coordinates. */
  readonly xStart: number
  /** Right end of the fragment in layout coordinates. */
  readonly xEnd: number
  /** Center line y; below the baseline is negative for underlines. */
  readonly y: number
  /** Stroke thickness, or dot diameter when dotted. */
  readonly thickness: number
  /** Peak wave displacement from `y`; zero unless wavy. */
  readonly amplitude: number
  /** Dot-center spacing for dotted lines and wave period for wavy lines; zero for solid. */
  readonly wavelength: number
  /**
   * Pattern phase at `xStart`, in layout units.
   *
   * @remarks
   * Zero at the start of every line, bidi interval, and adjacent span. Clipping
   * and skip-ink cuts advance it by what the removed portion consumed, so the
   * pattern stays continuous across gaps.
   */
  readonly phase: number
  /** Skip-ink policy in force for this fragment. */
  readonly skipInk: DecorationSkipInk
}

/** Aggregate bounds of derived decorations, in layout coordinates. */
export type DecorationBounds = LayoutBounds

/** The frozen result of {@link deriveTextDecorations}. */
export interface TextDecorationResult {
  /** Resolved fragments, in span then line order. */
  readonly segments: readonly DecorationSegment[]
  /** Union of every segment's extent, or `null` when there are no segments. */
  readonly bounds: DecorationBounds | null
}

/**
 * How a fixture's recorded behavior relates to the reference implementation:
 * deliberately matched, deliberately diverged, or not yet decided.
 */
export type FixtureClassification = 'preserve' | 'intentional-change' | 'defer'

/** Which evidence layer a fixture's expectations were derived from. */
export type FixtureEvidenceLayer = 'synthetic' | 'troika-reference' | 'font-integration'

/** Provenance of a fixture's expected values. */
export interface FixtureEvidence {
  /** Evidence layer this fixture belongs to. */
  readonly layer: FixtureEvidenceLayer
  /** Human-readable origin of the expectation. */
  readonly source: string
  /** Integrity digest pinning the source. */
  readonly integrity: string
}

/** One selection query and the rectangles it is expected to produce. */
export interface LayoutSelectionExpectation {
  /** The query to run. */
  readonly query: SelectionQuery
  /** Rectangles {@link getSelectionRects} must return. */
  readonly rects: readonly SelectionRect[]
}

/**
 * One recorded layout policy case: an input, its expected result, and the
 * rationale for treating that result as correct.
 *
 * @remarks
 * Part of the package's validation infrastructure rather than its runtime API.
 * Fixtures pin observable layout behavior so that dependency upgrades and
 * refactors surface as explicit, reviewed diffs.
 */
export interface LayoutPolicyFixture {
  /** Unique identifier within the document. */
  readonly id: string
  /** What behavior this case is intended to pin. */
  readonly intent: string
  /** Free-form tags for grouping and filtering. */
  readonly tags: readonly string[]
  /** How this case relates to the reference implementation. */
  readonly classification: FixtureClassification
  /** Why the expected values are considered correct. */
  readonly rationale: string
  /** Provenance of the expected values. */
  readonly evidence: FixtureEvidence
  /** Input handed to {@link layoutResolvedText}. */
  readonly input: ResolvedLayoutInput
  /** The result that input must produce. */
  readonly expected: LayoutResult
  /** Selection queries and their expected rectangles. */
  readonly selections: readonly LayoutSelectionExpectation[]
}

/**
 * A complete fixture file: schema version, comparison precision, and cases.
 *
 * @see {@link validateLayoutFixtureDocument}
 */
export interface LayoutFixtureDocument {
  /** Schema version of this document; currently always `1`. */
  readonly schemaVersion: 1
  /** Decimal places used when comparing and serializing numbers; `0`–`12`. */
  readonly numericPrecision: number
  /** The recorded cases; must not be empty. */
  readonly fixtures: readonly LayoutPolicyFixture[]
}

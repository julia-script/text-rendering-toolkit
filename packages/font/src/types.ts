/**
 * Writing direction of a single already-resolved run, in HarfBuzz terms.
 *
 * @remarks
 * This is a property of the run handed to {@link FontHandle.shape}, not
 * something the package infers. Deciding that a paragraph of mixed Hebrew and
 * English splits into an `rtl` run and an `ltr` run is bidi orchestration, and
 * belongs to the layout package; by the time text reaches this package the
 * decision has already been made.
 */
export type TextDirection = 'ltr' | 'rtl' | 'ttb' | 'btt'

/**
 * OpenType variation axis settings, as a map of four-character axis tags to
 * user-space coordinates — `{ wght: 700, wdth: 87.5 }`.
 *
 * @remarks
 * Values are in the axis's own user-space units (weight 100–900, width as a
 * percentage), not normalized to −1…1. Every tag must be an axis the font
 * actually defines; unknown tags are rejected rather than ignored, so a typo
 * fails loudly instead of silently rendering the default instance. Values
 * outside an axis's range are clamped to it.
 *
 * @see {@link VariationAxis} for the ranges a font declares.
 */
export type VariationCoordinates = Readonly<Record<string, number>>

/**
 * One OpenType variation axis declared by a variable font, with the range its
 * coordinate is clamped to.
 *
 * @remarks
 * A static font declares no axes at all, so {@link FontFacts.axes} is empty —
 * that emptiness is the test for "is this font variable?".
 */
export interface VariationAxis {
  /** Four-character axis tag, such as `wght`, `wdth`, or `slnt`. */
  readonly tag: string
  /** Lowest coordinate the font supports on this axis. */
  readonly min: number
  /** Coordinate used when the caller supplies none for this axis. */
  readonly default: number
  /** Highest coordinate the font supports on this axis. */
  readonly max: number
}

/**
 * Underline and strikethrough placement for the font's default instance, in
 * font units.
 *
 * @remarks
 * Positions are baseline-relative in the font's y-up coordinate space, so
 * `underlinePosition` is normally negative (below the baseline) and
 * `strikethroughPosition` positive (through the x-height). Both describe the
 * *center* of the rule, not its top edge.
 *
 * Declared values come from the font's `post` and `OS/2` tables. When those
 * tables are absent, or declare a non-positive thickness, deterministic values
 * derived from units-per-em and the vertical facts are substituted — so these
 * fields are always usable and never zero-thickness. A table that is present
 * but malformed rejects the font instead.
 *
 * These are default-instance metrics: they do not pick up MVAR adjustments for
 * a specific variation coordinate. Scale by `fontSize / unitsPerEm` like every
 * other font fact before use.
 */
export interface FontDecorationMetrics {
  /** Center of the underline rule, in font units below the baseline (negative). */
  readonly underlinePosition: number
  /** Underline rule thickness in font units; always positive. */
  readonly underlineThickness: number
  /** Center of the strikethrough rule, in font units above the baseline. */
  readonly strikethroughPosition: number
  /** Strikethrough rule thickness in font units; always positive. */
  readonly strikethroughThickness: number
}

/**
 * Everything the package knows about a loaded font up front, read once at load
 * time and reused for the handle's lifetime.
 *
 * @remarks
 * All distances are in font units — divide by {@link FontFacts.unitsPerEm} and
 * multiply by your pixel size to get pixels. The object and its nested members
 * are frozen and identity-stable, so `facts.decorationMetrics` returns the same
 * object on every access and is safe to use as a cache key.
 *
 * @example
 * Convert the vertical facts into a pixel line height.
 * ```typescript
 * const font = await loadFont(fontBytes)
 * const { unitsPerEm, ascender, descender, lineGap } = font.facts
 * const scale = 16 / unitsPerEm
 * const lineHeight = (ascender - descender + lineGap) * scale
 * ```
 */
export interface FontFacts {
  /** Font design grid size; the denominator for every other distance here. */
  readonly unitsPerEm: number
  /** Distance from baseline to the top of the typical ascender, positive. */
  readonly ascender: number
  /** Distance from baseline to the bottom of the typical descender, negative. */
  readonly descender: number
  /** Extra leading the font asks for between lines, often zero. */
  readonly lineGap: number
  /** Underline and strikethrough placement for the default instance. */
  readonly decorationMetrics: FontDecorationMetrics
  /**
   * Number of distinct Unicode code points the font's cmap covers.
   *
   * @remarks
   * Useful as a cheap comparative signal when ranking fallback candidates. To
   * ask about one specific character, call {@link FontHandle.supports} instead
   * of reasoning about this count.
   */
  readonly coverageCount: number
  /** Variation axes the font declares, sorted by tag; empty for static fonts. */
  readonly axes: readonly VariationAxis[]
}

/**
 * One shaping request: a single run of text whose direction, script, and
 * language have already been resolved.
 *
 * @remarks
 * The caller owns run segmentation. `shape` will happily shape whatever string
 * it is handed under the stated properties, so passing a whole mixed-script
 * paragraph produces technically-valid but typographically wrong output —
 * split it into runs first.
 *
 * @see {@link FontHandle.shape}
 */
export interface ShapeInput {
  /** The run's text. May be empty, which shapes to zero glyphs. */
  readonly text: string
  /** Resolved direction for this run. */
  readonly direction: TextDirection
  /** Four-letter ISO 15924 script code, such as `Latn`, `Arab`, or `Deva`. */
  readonly script: string
  /** BCP 47 language tag, such as `en` or `sr-Latn`; affects language-specific forms. */
  readonly language: string
  /**
   * OpenType feature settings in HarfBuzz string syntax — `liga=1` to force
   * ligatures on, `-liga` or `liga=0` to turn them off, `ss01` to enable a
   * stylistic set.
   *
   * @defaultValue `[]` — the font's own default feature set applies.
   */
  readonly features?: readonly string[]
  /**
   * Variation coordinates for this call only; they do not persist to the next.
   *
   * @defaultValue `{}` — the font's default instance.
   */
  readonly variations?: VariationCoordinates
}

/**
 * One positioned glyph produced by shaping, tied back to the source text that
 * produced it.
 *
 * @remarks
 * Glyphs are not characters. Shaping may fuse several characters into one
 * glyph (the `ffi` ligature) or expand one character into several (an Indic
 * vowel that splits around its consonant), so never assume glyph *n* comes
 * from character *n*. The cluster fields are the reliable mapping back to text.
 *
 * All positional values are in font units at the font's own upem scale.
 */
export interface ShapedGlyph {
  /** Font-internal glyph index; pass to {@link FontHandle.getOutline}. */
  readonly glyphId: number
  /** Inclusive UTF-16 index in the run's text where this glyph's cluster starts. */
  readonly clusterStart: number
  /** Exclusive UTF-16 index where this glyph's cluster ends. */
  readonly clusterEnd: number
  /**
   * The source substring this glyph covers — `text.slice(clusterStart,
   * clusterEnd)`, precomputed. Cluster boundaries never split a surrogate pair.
   */
  readonly sourceText: string
  /** Horizontal pen movement after drawing this glyph, in font units. */
  readonly xAdvance: number
  /** Vertical pen movement after drawing this glyph; zero for horizontal runs. */
  readonly yAdvance: number
  /** Horizontal nudge applied when drawing, without affecting the pen. */
  readonly xOffset: number
  /** Vertical nudge applied when drawing, without affecting the pen. */
  readonly yOffset: number
  /**
   * Raw `hb_glyph_flags_t` bitmask, passed through from HarfBuzz unmodified.
   *
   * @remarks
   * This package neither masks nor reinterprets the value, so its bit meanings
   * are HarfBuzz's — currently `0x1` (`UNSAFE_TO_BREAK`), `0x2`
   * (`UNSAFE_TO_CONCAT`), and `0x4` (`SAFE_TO_INSERT_TATWEEL`). Test with a
   * mask rather than equality; HarfBuzz may define further bits.
   */
  readonly flags: number
}

/**
 * The result of shaping one run: its glyphs plus the resolved inputs that
 * produced them.
 *
 * @remarks
 * The echoed `direction`, `script`, `language`, and `variations` make the
 * result self-describing, which matters because {@link FontHandle.getOutline}
 * needs the same variation coordinates to produce matching outlines. Passing
 * `run.variations` straight through is both correct and cache-friendly — it is
 * already in the canonical, clamped, tag-sorted form the outline cache keys on.
 *
 * @example
 * Measure a run's total advance width in pixels.
 * ```typescript
 * const run = font.shape({ text: 'office', direction: 'ltr', script: 'Latn', language: 'en' })
 * const units = run.glyphs.reduce((total, glyph) => total + glyph.xAdvance, 0)
 * const width = (units * 16) / font.facts.unitsPerEm
 * ```
 */
export interface ShapedRun {
  /** Positioned glyphs in visual order for the run's direction. */
  readonly glyphs: readonly ShapedGlyph[]
  /** Length of the shaped text in UTF-16 code units; the ceiling for cluster indices. */
  readonly textLengthUtf16: number
  /** Direction this run was shaped with. */
  readonly direction: TextDirection
  /** Script this run was shaped with. */
  readonly script: string
  /** Language this run was shaped with. */
  readonly language: string
  /** Variations actually applied, clamped to axis ranges and sorted by tag. */
  readonly variations: VariationCoordinates
}

/**
 * Path opcodes used by {@link GlyphOutline.commands}, and how many coordinate
 * values each one consumes.
 *
 * @remarks
 * Each opcode pops its operands from the flat
 * {@link GlyphOutline.coordinates} array in order: `MOVE_TO` and `LINE_TO` take
 * 2 (an endpoint), `QUADRATIC_TO` takes 4 (one control point plus an endpoint),
 * `CUBIC_TO` takes 6 (two control points plus an endpoint), and `CLOSE_PATH`
 * takes none. Walking the two arrays in lockstep is the intended way to consume
 * an outline — see {@link GlyphOutline} for a worked loop.
 *
 * This is a const object rather than a TypeScript `enum`, so it survives
 * `isolatedModules` and erasable-syntax builds. The value and the type share a
 * name: use `OutlineCommand.MOVE_TO` for the opcode, `OutlineCommand` for the
 * union of all five.
 */
export const OutlineCommand = {
  /** Start a new contour at the following point. Consumes 2 coordinates. */
  MOVE_TO: 0,
  /** Straight segment to the following point. Consumes 2 coordinates. */
  LINE_TO: 1,
  /** Quadratic Bézier: one control point, then the endpoint. Consumes 4. */
  QUADRATIC_TO: 2,
  /** Cubic Bézier: two control points, then the endpoint. Consumes 6. */
  CUBIC_TO: 3,
  /** Close the current contour back to its start. Consumes no coordinates. */
  CLOSE_PATH: 4,
} as const

/** Union of the five {@link OutlineCommand} opcode values. */
export type OutlineCommand = (typeof OutlineCommand)[keyof typeof OutlineCommand]

/**
 * Axis-aligned bounding box of a glyph outline, in font units.
 *
 * @remarks
 * The box is y-up and baseline-relative, so `yMin` is typically negative for
 * glyphs with descenders. It covers the outline's control points as well as its
 * on-curve points, making it a conservative (never-too-small) bound — good for
 * atlas allocation, slightly loose for tight visual bounds.
 *
 * An empty glyph such as a space reports all four fields as `0` rather than an
 * inverted or infinite box.
 */
export interface GlyphBounds {
  /** Leftmost extent in font units. */
  readonly xMin: number
  /** Bottommost extent in font units; negative below the baseline. */
  readonly yMin: number
  /** Rightmost extent in font units. */
  readonly xMax: number
  /** Topmost extent in font units. */
  readonly yMax: number
}

/**
 * A glyph's contours as flat numeric data — no SVG path string is built or
 * parsed on the way in or out.
 *
 * @remarks
 * The representation is two parallel arrays: `commands` holds one opcode per
 * path operation, and `coordinates` holds every operand back to back. Advance
 * through `coordinates` by the operand count of each opcode.
 *
 * Both typed arrays and the containing object are shared and must be treated as
 * readonly: {@link FontHandle.getOutline} caches per glyph and variation set and
 * hands back the identical object on a repeat call. Copy before mutating.
 *
 * @example
 * Walk an outline into whatever path sink you render with.
 * ```typescript
 * const outline = font.getOutline(glyphId, run.variations)
 * let at = 0
 * for (const command of outline.commands) {
 *   const c = outline.coordinates
 *   if (command === OutlineCommand.MOVE_TO) path.moveTo(c[at++]!, c[at++]!)
 *   else if (command === OutlineCommand.LINE_TO) path.lineTo(c[at++]!, c[at++]!)
 *   else if (command === OutlineCommand.QUADRATIC_TO)
 *     path.quadraticCurveTo(c[at++]!, c[at++]!, c[at++]!, c[at++]!)
 *   else if (command === OutlineCommand.CUBIC_TO)
 *     path.bezierCurveTo(c[at++]!, c[at++]!, c[at++]!, c[at++]!, c[at++]!, c[at++]!)
 *   else path.closePath()
 * }
 * ```
 */
export interface GlyphOutline {
  /** One {@link OutlineCommand} opcode per path operation. Treat this typed array as readonly. */
  readonly commands: Uint8Array
  /** Flat operand stream consumed by `commands`, in font units. Treat this typed array as readonly. */
  readonly coordinates: Float32Array
  /** Conservative bounding box of the contours above. */
  readonly bounds: GlyphBounds
}

/**
 * A straight (non-premultiplied) 8-bit RGBA color read from the font's CPAL
 * palette.
 *
 * @remarks
 * Every channel is an integer in `0`–`255`, including `alpha` — these are raw
 * palette bytes, not the `0`–`1` floats a GPU pipeline usually wants. Divide by
 * 255 when uploading.
 */
export interface RgbaColor {
  /** Red channel, `0`–`255`. */
  readonly red: number
  /** Green channel, `0`–`255`. */
  readonly green: number
  /** Blue channel, `0`–`255`. */
  readonly blue: number
  /** Alpha channel, `0`–`255`; `255` is opaque. */
  readonly alpha: number
}

/**
 * How one color-glyph layer is painted: either a fixed palette color, or the
 * sentinel `'foreground'`.
 *
 * @remarks
 * `'foreground'` is CPAL palette index `0xFFFF`, the font's way of saying "use
 * whatever text color the caller is drawing with". It is what lets a single
 * COLR glyph adapt to light and dark themes, so handle it rather than treating
 * it as a missing color — narrow with `layer.color === 'foreground'` before
 * reaching for the {@link RgbaColor} channels.
 */
export type ColorGlyphPaint = RgbaColor | 'foreground'

/**
 * One layer of a COLR v0 color glyph: a plain glyph outline plus the color to
 * fill it with.
 *
 * @remarks
 * Layers arrive in painting order — draw index `0` first and let later layers
 * composite over it with ordinary source-over alpha blending.
 *
 * @see {@link FontHandle.getColorLayers}
 */
export interface ColorGlyphLayer {
  /** Glyph to draw for this layer; fetch its contours with {@link FontHandle.getOutline}. */
  readonly glyphId: number
  /** Fill color, or `'foreground'` to use the caller's current text color. */
  readonly color: ColorGlyphPaint
}

/**
 * A loaded font, owning its HarfBuzz objects, its private copy of the font
 * bytes, and its outline and color-layer caches.
 *
 * @remarks
 * Obtained from {@link loadFont}; the class behind it is not exported. The
 * handle owns native WASM resources that garbage collection will not reclaim on
 * your schedule, so call {@link FontHandle.dispose} when finished — after which
 * every member except `dispose` itself throws {@link DisposedFontHandleError}.
 *
 * Handles are stateful but not stateless-per-call in one respect worth knowing:
 * shaping and outline extraction share one underlying HarfBuzz font, so they are
 * not safe to interleave across concurrent async work on the same handle. Within
 * a synchronous stretch of code, order does not matter — each call sets the
 * variation coordinates it needs before doing its work.
 *
 * @example
 * Shape a run and pull the outline for each glyph, then release the handle.
 * ```typescript
 * const font = await loadFont(fontBytes)
 * try {
 *   const run = font.shape({ text: 'office', direction: 'ltr', script: 'Latn', language: 'en' })
 *   for (const glyph of run.glyphs) {
 *     const outline = font.getOutline(glyph.glyphId, run.variations)
 *     draw(outline, glyph.xOffset, glyph.yOffset)
 *   }
 * } finally {
 *   font.dispose()
 * }
 * ```
 */
export interface FontHandle {
  /**
   * Metrics, coverage size, and variation axes read once at load time.
   *
   * @throws {@link DisposedFontHandleError} if the handle has been disposed.
   */
  readonly facts: FontFacts

  /**
   * Reports whether the font's cmap maps `codePoint` to a glyph.
   *
   * @remarks
   * This is the coverage test to drive font fallback with: a `false` here means
   * this font would render the character as `.notdef` (tofu), so a fallback font
   * should be tried. Note that coverage is not the same as *support* — a font
   * may map a code point yet lack the shaping rules to combine it well.
   *
   * @param codePoint - A Unicode scalar value: an integer in `0`–`0x10FFFF` and
   *   not a lone surrogate. Pass the value from `String#codePointAt`, not the
   *   UTF-16 unit from `charCodeAt`, or astral characters will misreport.
   * @returns `true` if the font covers the code point.
   * @throws {@link InvalidFontInputError} if `codePoint` is not a Unicode scalar value.
   * @throws {@link DisposedFontHandleError} if the handle has been disposed.
   *
   * @example
   * ```typescript
   * font.supports('A'.codePointAt(0)!) // true for a Latin font
   * font.supports('😀'.codePointAt(0)!) // false — needs an emoji fallback
   * ```
   */
  supports(codePoint: number): boolean

  /**
   * Shapes one resolved run of text into positioned glyphs.
   *
   * @remarks
   * Shaping applies the font's OpenType rules for the given script and
   * language: ligatures fuse, marks attach, Indic syllables reorder, Arabic
   * letters take their contextual forms. The glyph count therefore rarely
   * matches the character count.
   *
   * `input.features` and `input.variations` apply to this call only. Feed the
   * returned {@link ShapedRun.variations} to {@link FontHandle.getOutline} so
   * the outlines match the shaping.
   *
   * @param input - The run's text and its resolved direction, script, and
   *   language, plus optional features and variations.
   * @returns The positioned glyphs together with the resolved inputs.
   * @throws {@link InvalidShapingInputError} if any field is malformed — a
   *   non-four-letter script, an unknown variation axis, a feature string
   *   HarfBuzz cannot parse.
   * @throws {@link DisposedFontHandleError} if the handle has been disposed.
   *
   * @example
   * Ligatures collapse three characters into one glyph.
   * ```typescript
   * const run = font.shape({
   *   text: 'office',
   *   direction: 'ltr',
   *   script: 'Latn',
   *   language: 'en',
   *   features: ['liga=1'],
   *   variations: { wght: 700 },
   * })
   * run.glyphs.length // 4 — 'o', 'ffi', 'c', 'e'
   * run.glyphs[1]?.sourceText // 'ffi', spanning UTF-16 clusters 1..4
   * ```
   */
  shape(input: ShapeInput): ShapedRun

  /**
   * Returns a glyph's contours as flat numeric arrays, computing them on first
   * request and caching thereafter.
   *
   * @remarks
   * Outlines are cached per glyph ID and canonical variation set, and the cached
   * object is returned by identity — so repeated calls are cheap, and the result
   * must be treated as readonly. The cache lives until
   * {@link FontHandle.dispose}.
   *
   * Pass the {@link ShapedRun.variations} from the run that produced the glyph.
   * Omitting them silently gives you the default instance, which will not line up
   * with advances shaped at another weight.
   *
   * @param glyphId - Glyph index, normally from a {@link ShapedGlyph} or a
   *   {@link ColorGlyphLayer}. Must be an unsigned 32-bit integer. An ID the font
   *   does not define yields an empty outline rather than an error.
   * @param variations - Variation coordinates to apply.
   *   @defaultValue `{}` — the font's default instance.
   * @returns The glyph's commands, coordinates, and bounds; empty arrays and
   *   zero bounds for a blank glyph such as a space.
   * @throws {@link InvalidFontInputError} if `glyphId` is not an unsigned 32-bit
   *   integer, or {@link InvalidShapingInputError} if `variations` names an axis the
   *   font does not define.
   * @throws {@link DisposedFontHandleError} if the handle has been disposed.
   */
  getOutline(glyphId: number, variations?: VariationCoordinates): GlyphOutline

  /**
   * Returns a color glyph's COLR v0 layers using CPAL palette zero, or `null`
   * if the glyph has none.
   *
   * @remarks
   * `null` is the common, non-exceptional answer and means "render this glyph
   * the ordinary monochrome way": it covers plain outline fonts, non-color
   * glyphs inside a color font, and color formats this package does not
   * implement, including COLR v1. Only a genuinely malformed COLR or CPAL table
   * raises an error.
   *
   * The COLR and CPAL tables are parsed lazily on the first call for any glyph
   * and results are cached per glyph, so probing a non-color font stays cheap.
   *
   * @param glyphId - Glyph index, normally from a {@link ShapedGlyph}. Must be
   *   an unsigned 32-bit integer.
   * @returns Layers in painting order, or `null` when the glyph is not a COLR v0
   *   color glyph.
   * @throws {@link InvalidFontInputError} if `glyphId` is not an unsigned 32-bit integer.
   * @throws {@link InvalidFontError} if the font's COLR or CPAL data is malformed.
   * @throws {@link DisposedFontHandleError} if the handle has been disposed.
   *
   * @example
   * Composite a color glyph, falling back to the plain outline when it is not one.
   * ```typescript
   * const layers = font.getColorLayers(glyph.glyphId)
   * if (layers === null) {
   *   draw(font.getOutline(glyph.glyphId, run.variations), textColor)
   * } else {
   *   for (const layer of layers) {
   *     const paint = layer.color === 'foreground' ? textColor : layer.color
   *     draw(font.getOutline(layer.glyphId, run.variations), paint)
   *   }
   * }
   * ```
   */
  getColorLayers(glyphId: number): readonly ColorGlyphLayer[] | null

  /**
   * Releases the handle's HarfBuzz objects, font bytes, and caches.
   *
   * @remarks
   * Idempotent — calling it twice is safe and the second call does nothing.
   * Every other member throws {@link DisposedFontHandleError} afterwards. Because the
   * underlying resources live in WASM memory rather than the JavaScript heap,
   * skipping disposal leaks them for the lifetime of the process; a `try` /
   * `finally` around the handle's use is the reliable pattern.
   */
  dispose(): void
}

/**
 * Accepted input to {@link loadFont}: raw SFNT bytes as either an
 * `ArrayBuffer` or a `Uint8Array`.
 *
 * @remarks
 * These must be decoded TTF or OTF bytes. WOFF and WOFF2 containers are
 * detected and rejected — decode them upstream. A `Uint8Array` view over part of
 * a larger buffer is honored exactly, and the bytes are copied on load, so the
 * caller may reuse or mutate the source buffer immediately afterwards.
 */
export type FontSource = ArrayBuffer | Uint8Array

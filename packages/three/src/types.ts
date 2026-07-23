import type { LayoutBounds, LayoutResult } from '@webgpu-text/layout'
import type {
  ColorRepresentation,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
} from 'three/webgpu'
import type { TextResources } from './resources.js'

/**
 * Material type backing a {@link Text}, chosen at construction by the `lit`
 * option.
 *
 * @remarks
 * `MeshBasicNodeMaterial` for the default unlit fill, `MeshStandardNodeMaterial`
 * when `lit: true`. The choice is fixed for the object's lifetime — there is no
 * runtime material switching — so construct a new `Text` to change it.
 */
export type TextMaterial = MeshBasicNodeMaterial | MeshStandardNodeMaterial

/** Bounding box of a glyph outline, in font units. */
export interface TextGlyphBounds {
  /** Leftmost extent. */
  readonly xMin: number
  /** Bottommost extent; negative below the baseline. */
  readonly yMin: number
  /** Rightmost extent. */
  readonly xMax: number
  /** Topmost extent. */
  readonly yMax: number
}

/**
 * A glyph's contours as flat numeric arrays, in font units.
 *
 * @remarks
 * Structurally identical to the font package's `GlyphOutline`, so a real
 * `FontHandle` satisfies it without adaptation. Declared locally rather than
 * imported so this package depends on the font package's *shape*, not its
 * implementation — which is what lets tests and alternative font sources supply
 * outlines directly.
 */
export interface TextGlyphOutline {
  /** One path opcode per operation: move, line, quadratic, cubic, close. */
  readonly commands: Uint8Array
  /** Flat coordinate operands consumed by `commands`. */
  readonly coordinates: Float32Array
  /** Bounding box used to frame the glyph's SDF cell. */
  readonly bounds: TextGlyphBounds
}

/**
 * A straight 8-bit RGBA color from a color font's palette.
 *
 * @remarks
 * Channels are `0`–`255` integers, including `alpha` — raw palette bytes, not
 * normalized floats.
 */
export interface TextRgbaColor {
  /** Red channel, `0`–`255`. */
  readonly red: number
  /** Green channel, `0`–`255`. */
  readonly green: number
  /** Blue channel, `0`–`255`. */
  readonly blue: number
  /** Alpha channel, `0`–`255`. */
  readonly alpha: number
}

/**
 * How one color-glyph layer is painted: a fixed palette color, or
 * `'foreground'`.
 *
 * @remarks
 * A `'foreground'` layer resolves to the base glyph's effective color — its
 * {@link TextOptions.styleColors} entry if one matches its style key, otherwise
 * {@link TextOptions.color}. That is what lets one color glyph follow the
 * surrounding text color.
 */
export type TextColorGlyphPaint = TextRgbaColor | 'foreground'

/**
 * One layer of a color glyph: an ordinary outline plus its paint.
 *
 * @remarks
 * Layers composite in array order, index `0` first.
 */
export interface TextColorGlyphLayer {
  /** Glyph whose outline this layer draws. */
  readonly glyphId: number
  /** Fill color, or `'foreground'` to inherit the text color. */
  readonly color: TextColorGlyphPaint
}

/**
 * The structural subset of `@webgpu-text/font` used by the renderer.
 *
 * @remarks
 * A real `FontHandle` satisfies this directly. Only two members are needed:
 * outlines are pulled lazily, and `getColorLayers` is optional — a font without
 * it renders every glyph through the ordinary monochrome path.
 *
 * Typed structurally so the renderer never imports the font package at runtime,
 * which keeps the layers independent and makes the renderer testable with
 * synthetic outlines.
 */
export interface TextFont {
  /** Returns a glyph's contours, optionally at specific variation coordinates. */
  getOutline(glyphId: number, variations?: Readonly<Record<string, number>>): TextGlyphOutline
  /** Returns a glyph's color layers, or `null` when it is not a color glyph. */
  getColorLayers?(glyphId: number): readonly TextColorGlyphLayer[] | null
}

/** Construction options for {@link TextResources}. */
export interface TextResourcesOptions {
  /**
   * Edge length in texels of each glyph's square SDF cell; a safe integer from
   * `16` through `512`.
   *
   * @remarks
   * Fixed for the owner's lifetime, and inherited by every {@link Text} that
   * borrows it. Larger cells sharpen big text at the cost of atlas memory,
   * which grows with the square of this value.
   *
   * @defaultValue `64`
   */
  readonly sdfSize?: number
}

/**
 * Options common to both the owned-resources and shared-resources forms of
 * {@link TextOptions}.
 *
 * @remarks
 * Exported so generated API documentation can resolve these properties; use
 * {@link TextOptions} when constructing a {@link Text}, since it also carries
 * the `resources`/`sdfSize` exclusivity rule.
 */
export interface TextOptionsBase {
  /**
   * The completed layout to render.
   *
   * @remarks
   * Produced by `@webgpu-text/layout`. It is consumed as-is and never expanded
   * or replaced, so the same result stays valid for measurement, selection, and
   * other renderer-neutral use.
   */
  readonly layout: LayoutResult
  /**
   * Map from the layout's font keys to caller-owned fonts.
   *
   * @remarks
   * Must cover every `fontKey` appearing in `layout.glyphs`. The application
   * retains ownership: this package never fetches, loads, or disposes fonts.
   */
  readonly fonts: ReadonlyMap<string, TextFont>
  /**
   * Whether to use a lit standard material instead of the flat unlit fill.
   *
   * @remarks
   * Fixed at construction — appearance updates reuse the same material, so
   * changing this later means building a new {@link Text}. When `true`, enable
   * shadow maps and lights at the scene level and use the ordinary
   * `castShadow` / `receiveShadow` mesh flags.
   *
   * @defaultValue `false`
   */
  readonly lit?: boolean
  /**
   * Base text color, as any Three.js color representation.
   *
   * @defaultValue `0xffffff`
   */
  readonly color?: ColorRepresentation
  /**
   * Per-style color overrides, keyed by the layout's style keys.
   *
   * @remarks
   * A glyph whose `styleKey` matches an entry uses that color; everything else
   * falls back to {@link TextOptionsBase.color}. This is how a single `Text`
   * renders multi-colored runs from one layout.
   *
   * @defaultValue `{}`
   */
  readonly styleColors?: Readonly<Record<string, ColorRepresentation>>
  /**
   * Uniform opacity from `0` through `1`.
   *
   * @defaultValue `1`
   */
  readonly opacity?: number
  /**
   * Local rectangular clip in layout coordinates, or `null` for no clipping.
   *
   * @remarks
   * Applied in the mesh's own space, so it scrolls and transforms with the
   * text. Bounds must be finite and non-inverted.
   *
   * @defaultValue `null`
   */
  readonly clipRect?: LayoutBounds | null
}

/**
 * Construction options for {@link Text}.
 *
 * @remarks
 * The union encodes a rule the type system can enforce: `resources` and
 * `sdfSize` are mutually exclusive. Supply `resources` to share an
 * application-owned {@link TextResources} — whose SDF size then governs — or
 * supply `sdfSize` (or neither) to let this `Text` create and own private
 * resources. Passing both is a compile-time error, and also throws at runtime.
 *
 * @example
 * Private resources, the shortest path for a single object.
 * ```typescript
 * const text = new Text({ layout, fonts, sdfSize: 64 })
 * ```
 *
 * @example
 * Shared resources across several labels.
 * ```typescript
 * const resources = new TextResources({ sdfSize: 64 })
 * const title = new Text({ layout: titleLayout, fonts, resources })
 * const label = new Text({ layout: labelLayout, fonts, resources })
 * ```
 */
export type TextOptions = TextOptionsBase &
  (
    | { readonly resources: TextResources; readonly sdfSize?: never }
    | { readonly resources?: undefined; readonly sdfSize?: number }
  )

/**
 * What a {@link Text} last successfully rendered.
 *
 * @remarks
 * `null` until the first successful `sync()`. Because it reflects the last
 * *committed* state, a failed update leaves the previous value in place — so it
 * always describes what is actually on screen.
 */
export interface TextCommittedState {
  /** The exact layout committed by the last successful sync. */
  readonly layoutResult: LayoutResult
  /** Number of glyph quads drawn, counting each color layer separately. */
  readonly instanceCount: number
}

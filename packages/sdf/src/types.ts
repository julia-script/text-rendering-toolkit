/**
 * Path opcodes used by {@link SdfOutline.commands}, and how many coordinate
 * values each one consumes.
 *
 * @remarks
 * Numerically identical to the font package's `OutlineCommand`, which is what
 * makes a `GlyphOutline` structurally usable as an {@link SdfOutline} with no
 * conversion step. The opcodes are duplicated here rather than imported so this
 * package stays independently installable with no dependencies.
 *
 * Operand counts: `MOVE_TO` and `LINE_TO` take 2, `QUADRATIC_TO` 4,
 * `CUBIC_TO` 6, and `CLOSE_PATH` none.
 */
export const SdfCommand = {
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

/** Union of the five {@link SdfCommand} opcode values. */
export type SdfCommand = (typeof SdfCommand)[keyof typeof SdfCommand]

/**
 * Vector geometry to rasterize, as two parallel flat arrays.
 *
 * @remarks
 * Structurally compatible with the font package's `GlyphOutline`, so the result
 * of `font.getOutline(...)` can be passed straight through.
 *
 * The arrays are validated strictly before any raster is allocated: commands
 * must be known opcodes, a draw command may not precede its `MOVE_TO`, a
 * `CLOSE_PATH` needs an open contour, coordinates must all be finite, and the
 * coordinate array must be consumed exactly — trailing values are an error
 * rather than being ignored. Neither array is mutated or retained.
 *
 * Multiple contours combine under the non-zero winding rule, so an inner
 * contour wound opposite to its outer one cuts a hole.
 */
export interface SdfOutline {
  /** One {@link SdfCommand} opcode per path operation. */
  readonly commands: Uint8Array
  /** Flat operand stream consumed by `commands`, in the caller's units. */
  readonly coordinates: Float32Array
}

/**
 * The region of outline space the bitmap covers.
 *
 * @remarks
 * Y-up, matching font outline space: `top` is greater than `bottom`. Geometry
 * outside the box is still considered when computing distances near the edges,
 * so a shape extending past the box does not produce a discontinuity — it is
 * simply clipped from the sampled output.
 *
 * Pad the box beyond the glyph's own bounds by at least `distance`, or the
 * outer half of the distance ramp gets cut off.
 */
export interface SdfViewBox {
  /** Left edge in outline units. Must be less than `right`. */
  readonly left: number
  /** Bottom edge in outline units. Must be less than `top`. */
  readonly bottom: number
  /** Right edge in outline units. */
  readonly right: number
  /** Top edge in outline units. */
  readonly top: number
}

/**
 * Everything {@link generateSdf} needs: geometry, the region to sample, the
 * raster size, and the encoding parameters.
 *
 * @remarks
 * Geometry, view box, and `distance` all share one caller-chosen unit system;
 * this package neither knows nor applies a scale.
 *
 * `width`/`height` are the output raster size and need not match the view box's
 * aspect ratio — a mismatch simply samples non-square texels.
 */
export interface GenerateSdfInput {
  /** The vector geometry to rasterize. */
  readonly outline: SdfOutline
  /** The region of outline space to sample. */
  readonly viewBox: SdfViewBox
  /** Output width in texels; a positive safe integer. */
  readonly width: number
  /** Output height in texels; a positive safe integer. */
  readonly height: number
  /**
   * Maximum encoded distance from the edge, in outline units.
   *
   * @remarks
   * The ramp's half-width: at exactly this distance from the edge a texel
   * saturates to `0` outside or `255` inside. Larger values give smoother
   * antialiasing and better support for effects like outlines and glow, at the
   * cost of resolution near the edge. Typically set equal to the padding added
   * around the glyph bounds.
   */
  readonly distance: number
  /**
   * Falloff shaping exponent applied to the normalized distance; must be
   * positive.
   *
   * @remarks
   * `1` gives a linear ramp. Higher values concentrate precision near the edge,
   * where it matters for crisp rendering, at the cost of the far field — `9` is
   * a common choice for text.
   */
  readonly exponent: number
}

/**
 * A generated single-channel signed distance field, carrying the parameters
 * needed to decode it.
 *
 * @remarks
 * `pixels` is a freshly allocated, caller-owned `Uint8Array` in **row-major
 * order with row zero at the bottom** of the view box, matching the y-up
 * outline space. Index it as `pixels[y * width + x]`. GPU texture uploads that
 * assume a top-down first row will render the field upside down; flip either
 * the data or the texture coordinates.
 *
 * Encoding places the shape's edge at the midpoint of the byte range: values
 * **above 128 are inside**, below 128 are outside, and the mathematical edge
 * rounds to 128. Texels at or beyond `distance` from the edge saturate to `0`
 * or `255`.
 *
 * The view box, `distance`, and `exponent` are echoed back so a renderer can
 * decode the field without needing the original input — the bitmap is
 * self-describing.
 */
export interface SdfBitmap {
  /** Single-channel coverage bytes, row-major, row zero at the bottom. */
  readonly pixels: Uint8Array
  /** Raster width in texels. */
  readonly width: number
  /** Raster height in texels. */
  readonly height: number
  /** Copy of the sampled region, for mapping texels back to outline space. */
  readonly viewBox: SdfViewBox
  /** The maximum encoded distance this field was generated with. */
  readonly distance: number
  /** The falloff exponent this field was generated with. */
  readonly exponent: number
}

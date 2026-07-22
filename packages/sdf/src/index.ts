/**
 * Pure, synchronous CPU signed-distance-field generation from numeric vector
 * outlines.
 *
 * @remarks
 * The package is one function — {@link generateSdf} — plus the types describing
 * its input and output. It has no production dependencies, touches no browser
 * global, and is independently installable.
 *
 * Its {@link SdfCommand} opcodes match the sibling font package's outline
 * opcodes numerically, so a glyph outline is structurally a valid
 * {@link SdfOutline} and needs no conversion. No font is imported or retained,
 * and no outline is ever computed eagerly.
 *
 * Two conventions are worth knowing before consuming a {@link SdfBitmap}: row
 * zero is the **bottom** of the view box (y-up, like outline space), and the
 * shape's edge encodes to **128**, with inside above and outside below.
 *
 * Texture packing, channel packing, GPU upload, background scheduling, MSDF,
 * and SVG or font parsing are all outside this package. Generation is
 * synchronous, so a caller that needs it off the main thread is free to wrap it.
 *
 * @packageDocumentation
 */

export { InvalidSdfInputError } from './errors.js'
export { generateSdf } from './generate.js'
export type { GenerateSdfInput, SdfBitmap, SdfOutline, SdfViewBox } from './types.js'
export { SdfCommand } from './types.js'

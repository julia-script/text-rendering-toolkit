/**
 * A rule-based implementation of the Unicode line breaking algorithm,
 * UAX #14 revision 55, targeting Unicode 17.0.0.
 *
 * @remarks
 * The package answers one question — where may a line be broken? — and answers
 * it as {@link findLineBreakOpportunities}, which returns ordered JavaScript
 * UTF-16 offsets. It measures no text, chooses no lines, and consults no font,
 * renderer, platform service, or network resource; choosing actual lines needs
 * glyph widths, which belong to the caller.
 *
 * The rules are evaluated in specification order with explicit carried state.
 * UAX #14 deleted its pair-table section no later than Unicode 13.0.0, because
 * rules such as LB30a's even/odd regional-indicator count cannot be expressed
 * as class-by-class matrix cells; no such table is used here.
 *
 * Every offset is a valid UTF-16 boundary, so no opportunity ever divides a
 * surrogate pair. The final boundary is always reported and always required,
 * per LB3.
 *
 * The implementation passes all 19,338 cases of the official
 * `LineBreakTest-17.0.0.txt` conformance corpus.
 *
 * CSS and locale tailoring, dictionary segmentation for complex-context
 * scripts, hyphenation, and optimal paragraph-wide breaking are out of scope.
 *
 * @packageDocumentation
 */

export { analyzeLineBreaks as findLineBreakOpportunities } from './analyze.js'
export { LineBreakStream } from './stream.js'
export { UNICODE_VERSION } from './tables.js'
export type { LineBreakOpportunity } from './types.js'

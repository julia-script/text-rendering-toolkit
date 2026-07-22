import type { CaretStop, LayoutResult, SelectionQuery, SelectionRect } from './types.js'

/**
 * Sorts rectangles by line then x and coalesces touching or overlapping
 * neighbours that share a line and vertical extent.
 *
 * Without this a selection emits one rectangle per caret gap, which a renderer
 * would draw as visibly seamed boxes at every glyph boundary.
 */
function mergeRects(rects: SelectionRect[]): SelectionRect[] {
  rects.sort((left, right) => left.lineIndex - right.lineIndex || left.left - right.left)
  const merged: SelectionRect[] = []
  for (const rect of rects) {
    const previous = merged.at(-1)
    if (
      previous &&
      previous.lineIndex === rect.lineIndex &&
      previous.bottom === rect.bottom &&
      previous.top === rect.top &&
      rect.left <= previous.right
    ) {
      merged[merged.length - 1] = { ...previous, right: Math.max(previous.right, rect.right) }
    } else {
      merged.push(rect)
    }
  }
  return merged
}

/**
 * Builds highlight rectangles covering a source range.
 *
 * @remarks
 * Pure geometry derived from the layout's caret stops — it needs only
 * `sourceLengthUtf16` and `carets`, so any structural subset of a
 * {@link LayoutResult} works.
 *
 * The query is forgiving by design, which is what makes it safe to wire
 * straight to a UI's anchor and focus offsets: `start` and `end` are sorted, so
 * a backwards drag works, and both are clamped to the text, so out-of-range
 * values are harmless. A collapsed range returns no rectangles.
 *
 * Multiple rectangles come back when the range spans lines or crosses a bidi
 * direction change; within a line, adjacent rectangles are merged, so the
 * result is the minimal covering set rather than one box per glyph.
 *
 * @param result - A layout, or any object carrying its `sourceLengthUtf16` and
 *   `carets`.
 * @param query - The source range to highlight, in any order.
 * @returns Merged rectangles ordered by line then x; empty for a collapsed or
 *   zero-length range.
 *
 * @example
 * ```typescript
 * getSelectionRects(result, { start: 0, end: 5 })
 * // [{ lineIndex: 0, left: 0, right: 58.2, bottom: -7.03, top: 32.98 }]
 *
 * getSelectionRects(result, { start: 3, end: 3 }) // [] — collapsed
 * getSelectionRects(result, { start: 5, end: 0 }) // same as 0..5
 * ```
 */
export function getSelectionRects(
  result: Pick<LayoutResult, 'sourceLengthUtf16' | 'carets'>,
  query: SelectionQuery,
): readonly SelectionRect[] {
  const from = Math.max(0, Math.min(result.sourceLengthUtf16, Math.min(query.start, query.end)))
  const to = Math.max(0, Math.min(result.sourceLengthUtf16, Math.max(query.start, query.end)))
  if (from === to) return []

  const carets = result.carets.filter((caret) => caret.offset >= from && caret.offset <= to)
  const rects: SelectionRect[] = []
  for (let index = 0; index < carets.length - 1; index++) {
    const first = carets[index] as CaretStop
    const second = carets[index + 1] as CaretStop
    if (first.lineIndex !== second.lineIndex) continue
    rects.push({
      lineIndex: first.lineIndex,
      left: Math.min(first.x, second.x),
      right: Math.max(first.x, second.x),
      bottom: Math.min(first.bottom, second.bottom),
      top: Math.max(first.top, second.top),
    })
  }
  return mergeRects(rects)
}

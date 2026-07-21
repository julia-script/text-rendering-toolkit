import type { CaretStop, LayoutResult, SelectionQuery, SelectionRect } from './types.js'

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

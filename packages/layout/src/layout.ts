import { InvalidLayoutInputError } from './errors.js'
import type {
  CaretStop,
  HorizontalAnchor,
  LayoutBounds,
  LayoutLine,
  LayoutResult,
  PositionedGlyph,
  ResolvedGlyph,
  ResolvedLayoutInput,
  ResolvedShapedRun,
  VerticalAnchor,
} from './types.js'

interface ClusterGlyph {
  readonly glyph: ResolvedGlyph
  readonly ordinal: number
}

interface Cluster {
  readonly start: number
  readonly end: number
  readonly run: ResolvedShapedRun
  readonly runIndex: number
  readonly visualIndex: number
  readonly glyphs: ClusterGlyph[]
  readonly advance: number
  readonly whitespace: boolean
  readonly caretOffsets: readonly number[]
}

interface HardSegment {
  readonly start: number
  readonly contentEnd: number
  readonly end: number
  readonly hard: boolean
}

interface LineWork {
  readonly start: number
  readonly end: number
  readonly clusters: readonly Cluster[]
  breakAfter: 'none' | 'hard' | 'soft'
  readonly indent: number
  readonly contentWidth: number
  readonly trailingStart: number
  readonly ascender: number
  readonly descender: number
  readonly lineGap: number
  baseline: number
  left: number
  right: number
}

interface ClusterPosition {
  readonly x: number
  readonly advance: number
}

interface PlacedSourceGlyph {
  readonly cluster: Cluster
  readonly source: ClusterGlyph
  readonly lineIndex: number
  readonly x: number
  readonly y: number
}

function invalid(message: string): never {
  throw new InvalidLayoutInputError(message)
}

function finite(value: number, label: string): void {
  if (!Number.isFinite(value)) invalid(`${label} must be finite`)
}

function utf16Boundary(text: string, offset: number): boolean {
  if (!Number.isInteger(offset) || offset < 0 || offset > text.length) return false
  if (offset === 0 || offset === text.length) return true
  const previous = text.charCodeAt(offset - 1)
  const current = text.charCodeAt(offset)
  return !(previous >= 0xd800 && previous <= 0xdbff && current >= 0xdc00 && current <= 0xdfff)
}

function validRange(text: string, start: number, end: number, label: string): void {
  if (start > end || !utf16Boundary(text, start) || !utf16Boundary(text, end)) {
    invalid(`${label} must be a valid half-open UTF-16 range`)
  }
}

function validAnchor(value: HorizontalAnchor | VerticalAnchor, label: string): void {
  if (typeof value === 'number') {
    finite(value, label)
    return
  }
  if (value.endsWith('%')) {
    if (value.trim() !== value || !Number.isFinite(Number(value.slice(0, -1)))) {
      invalid(`${label} has an invalid percentage`)
    }
    return
  }
  const keywords = [
    'left',
    'center',
    'right',
    'top',
    'top-baseline',
    'top-cap',
    'top-ex',
    'middle',
    'bottom',
    'bottom-baseline',
  ]
  if (!keywords.includes(value)) invalid(`${label} is invalid`)
}

function validateInput(input: ResolvedLayoutInput): void {
  if (input.paragraphLevel !== 0 && input.paragraphLevel !== 1) {
    invalid('paragraphLevel must be 0 or 1')
  }
  finite(input.defaultMetrics.ascender, 'defaultMetrics.ascender')
  finite(input.defaultMetrics.descender, 'defaultMetrics.descender')
  finite(input.defaultMetrics.lineGap, 'defaultMetrics.lineGap')
  if (input.defaultMetrics.ascender < input.defaultMetrics.descender) {
    invalid('defaultMetrics are inverted')
  }
  if (input.maxWidth !== null) {
    finite(input.maxWidth, 'maxWidth')
    if (input.maxWidth < 0) invalid('maxWidth must not be negative')
  }
  if (!['normal', 'nowrap'].includes(input.whiteSpace)) invalid('whiteSpace is invalid')
  if (!['normal', 'break-word'].includes(input.overflowWrap)) invalid('overflowWrap is invalid')
  if (!['left', 'center', 'right', 'justify'].includes(input.textAlign)) {
    invalid('textAlign is invalid')
  }
  finite(input.textIndent, 'textIndent')
  finite(input.letterSpacing, 'letterSpacing')
  if (input.lineHeight !== 'normal') {
    finite(input.lineHeight, 'lineHeight')
    if (input.lineHeight < 0) invalid('lineHeight must not be negative')
  }
  validAnchor(input.anchorX, 'anchorX')
  validAnchor(input.anchorY, 'anchorY')

  const covered = new Uint8Array(input.text.length)
  let previousRunEnd = 0
  for (const [runIndex, run] of input.runs.entries()) {
    validRange(input.text, run.start, run.end, `runs[${runIndex}]`)
    if (run.start === run.end) invalid(`runs[${runIndex}] must not be empty`)
    if (run.start < previousRunEnd) invalid(`runs[${runIndex}] overlaps the previous run`)
    previousRunEnd = run.end
    if (run.direction !== 'ltr' && run.direction !== 'rtl') {
      invalid(`runs[${runIndex}].direction is invalid`)
    }
    if (
      !Number.isInteger(run.bidiLevel) ||
      run.bidiLevel < 0 ||
      run.bidiLevel % 2 !== (run.direction === 'rtl' ? 1 : 0)
    ) {
      invalid(`runs[${runIndex}].bidiLevel parity does not match direction`)
    }
    if (!run.fontKey || !run.styleKey || !run.script || !run.language) {
      invalid(`runs[${runIndex}] identity fields must be non-empty`)
    }
    finite(run.fontSize, `runs[${runIndex}].fontSize`)
    if (run.fontSize <= 0) invalid(`runs[${runIndex}].fontSize must be positive`)
    finite(run.fontUnitScale, `runs[${runIndex}].fontUnitScale`)
    if (run.fontUnitScale <= 0) {
      invalid(`runs[${runIndex}].fontUnitScale must be positive`)
    }
    finite(run.metrics.ascender, `runs[${runIndex}].metrics.ascender`)
    finite(run.metrics.descender, `runs[${runIndex}].metrics.descender`)
    finite(run.metrics.lineGap, `runs[${runIndex}].metrics.lineGap`)
    if (run.metrics.ascender < run.metrics.descender) {
      invalid(`runs[${runIndex}].metrics are inverted`)
    }
    for (const [axis, value] of Object.entries(run.variations)) {
      if (!axis) invalid(`runs[${runIndex}].variations has an empty axis`)
      finite(value, `runs[${runIndex}].variations.${axis}`)
    }

    for (const [glyphIndex, glyph] of run.glyphs.entries()) {
      validRange(input.text, glyph.start, glyph.end, `runs[${runIndex}].glyphs[${glyphIndex}]`)
      if (glyph.start === glyph.end || glyph.start < run.start || glyph.end > run.end) {
        invalid(`runs[${runIndex}].glyphs[${glyphIndex}] is outside its run`)
      }
      if (/\r|\n/u.test(input.text.slice(glyph.start, glyph.end))) {
        invalid(`runs[${runIndex}].glyphs[${glyphIndex}] crosses a hard break`)
      }
      if (!Number.isInteger(glyph.glyphId) || glyph.glyphId < 0) {
        invalid(`runs[${runIndex}].glyphs[${glyphIndex}].glyphId is invalid`)
      }
      if (!Number.isInteger(glyph.flags)) {
        invalid(`runs[${runIndex}].glyphs[${glyphIndex}].flags must be an integer`)
      }
      for (const key of ['xAdvance', 'yAdvance', 'xOffset', 'yOffset'] as const) {
        finite(glyph[key], `runs[${runIndex}].glyphs[${glyphIndex}].${key}`)
      }
      if (glyph.bounds) {
        for (const key of ['left', 'bottom', 'right', 'top'] as const) {
          finite(glyph.bounds[key], `runs[${runIndex}].glyphs[${glyphIndex}].bounds.${key}`)
        }
        if (glyph.bounds.left > glyph.bounds.right || glyph.bounds.bottom > glyph.bounds.top) {
          invalid(`runs[${runIndex}].glyphs[${glyphIndex}].bounds are inverted`)
        }
      }
      covered.fill(1, glyph.start, glyph.end)
    }
  }

  for (let index = 0; index < input.text.length; index++) {
    const character = input.text[index]
    if (character !== '\r' && character !== '\n' && covered[index] === 0) {
      invalid(`source offset ${index} is unresolved`)
    }
  }
}

function graphemeBoundaries(text: string): Set<number> {
  const boundaries = new Set<number>([0, text.length])
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  for (const segment of segmenter.segment(text)) {
    boundaries.add(segment.index)
    boundaries.add(segment.index + segment.segment.length)
  }
  return boundaries
}

function buildClusters(input: ResolvedLayoutInput, boundaries: Set<number>): Cluster[] {
  const clusters: Cluster[] = []
  let ordinal = 0
  for (const [runIndex, run] of input.runs.entries()) {
    const grouped = new Map<string, Omit<Cluster, 'advance' | 'whitespace' | 'caretOffsets'>>()
    let visualIndex = 0
    for (const glyph of run.glyphs) {
      const key = `${glyph.start}:${glyph.end}`
      let cluster = grouped.get(key)
      if (!cluster) {
        cluster = {
          start: glyph.start,
          end: glyph.end,
          run,
          runIndex,
          visualIndex: visualIndex++,
          glyphs: [],
        }
        grouped.set(key, cluster)
      }
      cluster.glyphs.push({ glyph, ordinal: ordinal++ })
    }
    const runClusters = [...grouped.values()].sort(
      (left, right) => left.start - right.start || left.end - right.end,
    )
    for (let index = 1; index < runClusters.length; index++) {
      const previous = runClusters[index - 1]
      const current = runClusters[index]
      if (previous && current && current.start < previous.end) {
        invalid(`runs[${runIndex}] has overlapping glyph clusters`)
      }
    }
    for (const cluster of runClusters) {
      const advance = cluster.glyphs.reduce((sum, item) => sum + item.glyph.xAdvance, 0)
      const offsets = [...boundaries]
        .filter((offset) => offset >= cluster.start && offset <= cluster.end)
        .sort((left, right) => left - right)
      clusters.push({
        ...cluster,
        advance,
        whitespace: /^\s+$/u.test(input.text.slice(cluster.start, cluster.end)),
        caretOffsets: offsets,
      })
    }
  }
  return clusters.sort((left, right) => left.start - right.start || left.end - right.end)
}

function hardSegments(text: string): HardSegment[] {
  const segments: HardSegment[] = []
  let start = 0
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index)
    if (code !== 0x0a && code !== 0x0d) continue
    const breakLength = code === 0x0d && text.charCodeAt(index + 1) === 0x0a ? 2 : 1
    segments.push({ start, contentEnd: index, end: index + breakLength, hard: true })
    index += breakLength - 1
    start = index + 1
  }
  segments.push({ start, contentEnd: text.length, end: text.length, hard: false })
  return segments
}

function widths(
  clusters: readonly Cluster[],
  letterSpacing: number,
): {
  contentWidth: number
  trailingStart: number
} {
  let trailingStart = clusters.length
  while (trailingStart > 0 && clusters[trailingStart - 1]?.whitespace) trailingStart--
  let contentWidth = 0
  for (let index = 0; index < trailingStart; index++) {
    contentWidth += (clusters[index] as Cluster).advance
    if (index + 1 < trailingStart) contentWidth += letterSpacing
  }
  return { contentWidth, trailingStart }
}

function metricsForLine(
  input: ResolvedLayoutInput,
  start: number,
  end: number,
  clusters: readonly Cluster[],
): { ascender: number; descender: number; lineGap: number } {
  const runs = new Set(clusters.map((cluster) => cluster.run))
  if (runs.size === 0) {
    for (const run of input.runs) {
      const intersects =
        start === end ? run.start <= start && run.end >= end : run.start < end && run.end > start
      if (intersects) runs.add(run)
    }
  }
  if (runs.size === 0) return { ...input.defaultMetrics }
  return {
    ascender: Math.max(...[...runs].map((run) => run.metrics.ascender)),
    descender: Math.min(...[...runs].map((run) => run.metrics.descender)),
    lineGap: Math.max(...[...runs].map((run) => run.metrics.lineGap)),
  }
}

function createLine(
  input: ResolvedLayoutInput,
  start: number,
  end: number,
  clusters: readonly Cluster[],
  breakAfter: LineWork['breakAfter'],
  indent: number,
): LineWork {
  const width = widths(clusters, input.letterSpacing)
  const metrics = metricsForLine(input, start, end, clusters)
  return {
    start,
    end,
    clusters,
    breakAfter,
    indent,
    ...width,
    ...metrics,
    baseline: 0,
    left: 0,
    right: 0,
  }
}

function constructLines(input: ResolvedLayoutInput, clusters: readonly Cluster[]): LineWork[] {
  const lines: LineWork[] = []
  for (const segment of hardSegments(input.text)) {
    const segmentClusters = clusters.filter(
      (cluster) => cluster.start >= segment.start && cluster.end <= segment.contentEnd,
    )
    if (segmentClusters.length === 0) {
      lines.push(
        createLine(
          input,
          segment.start,
          segment.end,
          [],
          segment.hard ? 'hard' : 'none',
          lines.length === 0 ? input.textIndent : 0,
        ),
      )
      continue
    }

    let cursor = 0
    let logicalStart = segment.start
    while (cursor < segmentClusters.length) {
      const indent = lines.length === 0 ? input.textIndent : 0
      let runningWidth = indent
      let lastWhitespaceBreak = -1
      let breakAt = -1
      for (let index = cursor; index < segmentClusters.length; index++) {
        if (index > cursor) runningWidth += input.letterSpacing
        const cluster = segmentClusters[index] as Cluster
        runningWidth += cluster.advance
        if (cluster.whitespace) lastWhitespaceBreak = index + 1
        if (
          input.maxWidth !== null &&
          input.whiteSpace !== 'nowrap' &&
          runningWidth > input.maxWidth &&
          index > cursor
        ) {
          if (lastWhitespaceBreak > cursor) breakAt = lastWhitespaceBreak
          else if (
            input.overflowWrap === 'break-word' &&
            cluster.caretOffsets.includes(cluster.start)
          ) {
            breakAt = index
          }
          if (breakAt > cursor) break
        }
      }

      if (breakAt > cursor) {
        const lineClusters = segmentClusters.slice(cursor, breakAt)
        const logicalEnd = (lineClusters.at(-1) as Cluster).end
        lines.push(createLine(input, logicalStart, logicalEnd, lineClusters, 'soft', indent))
        cursor = breakAt
        logicalStart = logicalEnd
      } else {
        lines.push(
          createLine(
            input,
            logicalStart,
            segment.end,
            segmentClusters.slice(cursor),
            segment.hard ? 'hard' : 'none',
            indent,
          ),
        )
        cursor = segmentClusters.length
      }
    }
  }
  return lines
}

function visualClusters(clusters: readonly Cluster[]): Cluster[] {
  const fragments: Array<{ level: number; clusters: Cluster[] }> = []
  for (const cluster of clusters) {
    const previous = fragments.at(-1)
    if (previous && previous.clusters[0]?.runIndex === cluster.runIndex) {
      previous.clusters.push(cluster)
    } else {
      fragments.push({ level: cluster.run.bidiLevel, clusters: [cluster] })
    }
  }
  for (const fragment of fragments) {
    fragment.clusters.sort((left, right) => left.visualIndex - right.visualIndex)
  }
  const oddLevels = fragments.map((fragment) => fragment.level).filter((level) => level % 2 === 1)
  if (oddLevels.length > 0) {
    const maximum = Math.max(...fragments.map((fragment) => fragment.level))
    const minimumOdd = Math.min(...oddLevels)
    for (let level = maximum; level >= minimumOdd; level--) {
      let start = 0
      while (start < fragments.length) {
        while (start < fragments.length && (fragments[start]?.level ?? -1) < level) start++
        let end = start
        while (end < fragments.length && (fragments[end]?.level ?? -1) >= level) end++
        if (end > start)
          fragments.splice(start, end - start, ...fragments.slice(start, end).reverse())
        start = end
      }
    }
  }
  return fragments.flatMap((fragment) => fragment.clusters)
}

function alignmentLeft(input: ResolvedLayoutInput, line: LineWork, blockWidth: number): number {
  if (input.textAlign === 'center') return (blockWidth - line.contentWidth) / 2
  if (input.textAlign === 'right') return blockWidth - line.contentWidth
  return line.indent
}

function placeLines(
  input: ResolvedLayoutInput,
  lines: LineWork[],
): {
  blockWidth: number
  clusterPositions: Map<Cluster, ClusterPosition>
  placed: PlacedSourceGlyph[]
} {
  for (let index = 1; index < lines.length; index++) {
    const previous = lines[index - 1] as LineWork
    const line = lines[index] as LineWork
    const advance =
      input.lineHeight === 'normal'
        ? previous.ascender - previous.descender + previous.lineGap
        : input.lineHeight
    line.baseline = previous.baseline - advance
  }
  const naturalWidth = Math.max(0, ...lines.map((line) => line.indent + line.contentWidth))
  const blockWidth = input.maxWidth === null ? naturalWidth : Math.max(input.maxWidth, naturalWidth)
  const clusterPositions = new Map<Cluster, ClusterPosition>()
  const placed: PlacedSourceGlyph[] = []

  for (const [lineIndex, line] of lines.entries()) {
    line.left = alignmentLeft(input, line, blockWidth)
    const eligibleWhitespace = line.clusters.filter(
      (cluster, index) => cluster.whitespace && index < line.trailingStart,
    )
    const justify = input.textAlign === 'justify' && eligibleWhitespace.length > 0
    const extra = justify
      ? Math.max(0, blockWidth - line.left - line.contentWidth) / eligibleWhitespace.length
      : 0
    if (justify && line.breakAfter === 'none') line.breakAfter = 'soft'
    line.right = justify ? blockWidth : line.left + line.contentWidth

    const visual = visualClusters(line.clusters)
    let pen = line.left
    for (const [visualIndex, cluster] of visual.entries()) {
      const spacing = visualIndex + 1 < visual.length ? input.letterSpacing : 0
      const expanded =
        cluster.whitespace && line.clusters.indexOf(cluster) < line.trailingStart ? extra : 0
      const advance = cluster.advance + spacing + expanded
      clusterPositions.set(cluster, { x: pen, advance })
      if (!cluster.whitespace) {
        for (const source of cluster.glyphs) {
          placed.push({ cluster, source, lineIndex, x: pen, y: line.baseline })
        }
      }
      pen += advance
    }
  }
  return { blockWidth, clusterPositions, placed }
}

function positionedGlyph(source: PlacedSourceGlyph): PositionedGlyph {
  const { glyph } = source.source
  return {
    start: glyph.start,
    end: glyph.end,
    fontKey: source.cluster.run.fontKey,
    styleKey: source.cluster.run.styleKey,
    glyphId: glyph.glyphId,
    variations: { ...source.cluster.run.variations },
    fontUnitScale: source.cluster.run.fontUnitScale,
    lineIndex: source.lineIndex,
    x: source.x,
    y: source.y,
    xAdvance: glyph.xAdvance,
    yAdvance: glyph.yAdvance,
    xOffset: glyph.xOffset,
    yOffset: glyph.yOffset,
    bounds: glyph.bounds ? { ...glyph.bounds } : null,
  }
}

function visibleBounds(glyphs: readonly PositionedGlyph[]): LayoutBounds | null {
  let result: LayoutBounds | null = null
  for (const glyph of glyphs) {
    if (!glyph.bounds) continue
    const item = {
      left: glyph.x + glyph.xOffset + glyph.bounds.left,
      bottom: glyph.y + glyph.yOffset + glyph.bounds.bottom,
      right: glyph.x + glyph.xOffset + glyph.bounds.right,
      top: glyph.y + glyph.yOffset + glyph.bounds.top,
    }
    result = result
      ? {
          left: Math.min(result.left, item.left),
          bottom: Math.min(result.bottom, item.bottom),
          right: Math.max(result.right, item.right),
          top: Math.max(result.top, item.top),
        }
      : item
  }
  return result
}

function buildCarets(
  input: ResolvedLayoutInput,
  lines: readonly LineWork[],
  positions: ReadonlyMap<Cluster, ClusterPosition>,
): CaretStop[] {
  const carets = new Map<number, CaretStop>()
  for (const [lineIndex, line] of lines.entries()) {
    const bottom = line.baseline + input.defaultMetrics.descender
    const top =
      input.lineHeight === 'normal' ? line.baseline + line.ascender : bottom + input.lineHeight
    const first = line.clusters[0]
    if (!carets.has(line.start)) {
      const position = first ? positions.get(first) : undefined
      const x =
        first && position
          ? first.run.direction === 'rtl'
            ? position.x + position.advance
            : position.x
          : line.left
      carets.set(line.start, { offset: line.start, lineIndex, x, bottom, top })
    }

    for (const cluster of line.clusters) {
      const position = positions.get(cluster)
      if (!position) continue
      const startX = cluster.run.direction === 'rtl' ? position.x + position.advance : position.x
      const endX = cluster.run.direction === 'rtl' ? position.x : position.x + position.advance
      const offsets = cluster.caretOffsets
      for (const [offsetIndex, offset] of offsets.entries()) {
        if (offset === line.end && lines[lineIndex + 1]?.start === line.end) continue
        if (carets.has(offset)) continue
        const ratio = offsets.length === 1 ? 0 : offsetIndex / (offsets.length - 1)
        carets.set(offset, {
          offset,
          lineIndex,
          x: startX + (endX - startX) * ratio,
          bottom,
          top,
        })
      }
    }
  }
  return [...carets.values()].sort((left, right) => left.offset - right.offset)
}

function percent(value: string): number {
  return Number(value.slice(0, -1)) / 100
}

function horizontalShift(anchor: HorizontalAnchor, bounds: LayoutBounds): number {
  if (typeof anchor === 'number') return anchor
  const width = bounds.right - bounds.left
  if (anchor === 'left') return -bounds.left
  if (anchor === 'center') return -(bounds.left + bounds.right) / 2
  if (anchor === 'right') return -bounds.right
  return -bounds.left - width * percent(anchor)
}

function verticalShift(
  anchor: VerticalAnchor,
  bounds: LayoutBounds,
  lines: readonly LayoutLine[],
): number {
  if (typeof anchor === 'number') return anchor
  if (anchor === 'top-baseline') return -(lines[0]?.baseline ?? 0)
  if (anchor === 'bottom-baseline') return -(lines.at(-1)?.baseline ?? 0)
  if (anchor === 'top' || anchor === 'top-cap' || anchor === 'top-ex') return -bounds.top
  if (anchor === 'middle') return -(bounds.bottom + bounds.top) / 2
  if (anchor === 'bottom') return -bounds.bottom
  const height = bounds.top - bounds.bottom
  return -bounds.top + height * percent(anchor)
}

function translateBounds(bounds: LayoutBounds, x: number, y: number): LayoutBounds {
  return {
    left: bounds.left + x,
    bottom: bounds.bottom + y,
    right: bounds.right + x,
    top: bounds.top + y,
  }
}

export function layoutResolvedText(input: ResolvedLayoutInput): LayoutResult {
  validateInput(input)
  const clusters = buildClusters(input, graphemeBoundaries(input.text))
  const lineWork = constructLines(input, clusters)
  const placement = placeLines(input, lineWork)
  const placed = placement.placed.sort(
    (left, right) =>
      left.lineIndex - right.lineIndex ||
      left.source.glyph.start - right.source.glyph.start ||
      left.source.glyph.end - right.source.glyph.end ||
      left.source.ordinal - right.source.ordinal,
  )
  const glyphs = placed.map(positionedGlyph)
  const lineGlyphCounts = lineWork.map(
    (_, lineIndex) => glyphs.filter((glyph) => glyph.lineIndex === lineIndex).length,
  )
  let glyphCursor = 0
  const lines: LayoutLine[] = lineWork.map((line, index) => {
    const glyphStart = glyphCursor
    glyphCursor += lineGlyphCounts[index] ?? 0
    return {
      start: line.start,
      end: line.end,
      glyphStart,
      glyphEnd: glyphCursor,
      baseline: line.baseline,
      left: line.left,
      right: line.right,
      bottom: line.baseline + input.defaultMetrics.descender,
      top:
        input.lineHeight === 'normal'
          ? line.baseline + line.ascender
          : line.baseline + input.defaultMetrics.descender + input.lineHeight,
      breakAfter: line.breakAfter,
    }
  })
  const carets = buildCarets(input, lineWork, placement.clusterPositions)
  const blockBounds: LayoutBounds =
    input.text.length === 0 || lines.length === 0
      ? { left: 0, bottom: 0, right: placement.blockWidth, top: 0 }
      : {
          left: 0,
          bottom: Math.min(...lineWork.map((line) => line.baseline + line.descender)),
          right: placement.blockWidth,
          top: Math.max(...lineWork.map((line) => line.baseline + line.ascender)),
        }
  const visible = visibleBounds(glyphs)
  const shiftX = horizontalShift(input.anchorX, blockBounds)
  const shiftY = verticalShift(input.anchorY, blockBounds, lines)

  return {
    sourceLengthUtf16: input.text.length,
    fontKeys: [...new Set(input.runs.map((run) => run.fontKey))],
    glyphs: glyphs.map((glyph) => ({ ...glyph, x: glyph.x + shiftX, y: glyph.y + shiftY })),
    lines: lines.map((line) => ({
      ...line,
      baseline: line.baseline + shiftY,
      left: line.left + shiftX,
      right: line.right + shiftX,
      bottom: line.bottom + shiftY,
      top: line.top + shiftY,
    })),
    carets: carets.map((caret) => ({
      ...caret,
      x: caret.x + shiftX,
      bottom: caret.bottom + shiftY,
      top: caret.top + shiftY,
    })),
    blockBounds: translateBounds(blockBounds, shiftX, shiftY),
    visibleBounds: visible ? translateBounds(visible, shiftX, shiftY) : null,
  }
}

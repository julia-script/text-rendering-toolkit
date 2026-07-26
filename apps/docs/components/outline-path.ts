import { type GlyphOutline, OutlineCommand } from '@text-rendering-toolkit/font'

export interface OutlinePoint {
  readonly x: number
  readonly y: number
}

export interface OutlineHandle {
  readonly from: OutlinePoint
  readonly to: OutlinePoint
}

export interface OutlineGeometry {
  readonly controls: readonly OutlinePoint[]
  readonly d: string
  readonly endpoints: readonly OutlinePoint[]
  readonly handles: readonly OutlineHandle[]
}

export function outlineGeometry(outline: GlyphOutline): OutlineGeometry {
  const controls: OutlinePoint[] = []
  const endpoints: OutlinePoint[] = []
  const handles: OutlineHandle[] = []
  const parts: string[] = []
  let offset = 0
  let current: OutlinePoint | undefined

  const point = (): OutlinePoint => {
    const x = outline.coordinates[offset]
    const y = outline.coordinates[offset + 1]
    if (x === undefined || y === undefined) throw new Error('Glyph outline coordinate is missing')
    offset += 2
    return { x, y }
  }
  const requireCurrent = () => {
    if (!current) throw new Error('Glyph outline curve has no start point')
    return current
  }

  for (const command of outline.commands) {
    if (command === OutlineCommand.MOVE_TO) {
      current = point()
      endpoints.push(current)
      parts.push(`M${current.x} ${current.y}`)
    } else if (command === OutlineCommand.LINE_TO) {
      current = point()
      endpoints.push(current)
      parts.push(`L${current.x} ${current.y}`)
    } else if (command === OutlineCommand.QUADRATIC_TO) {
      const start = requireCurrent()
      const control = point()
      current = point()
      controls.push(control)
      endpoints.push(current)
      handles.push({ from: start, to: control }, { from: current, to: control })
      parts.push(`Q${control.x} ${control.y} ${current.x} ${current.y}`)
    } else if (command === OutlineCommand.CUBIC_TO) {
      const start = requireCurrent()
      const control1 = point()
      const control2 = point()
      current = point()
      controls.push(control1, control2)
      endpoints.push(current)
      handles.push({ from: start, to: control1 }, { from: current, to: control2 })
      parts.push(
        `C${control1.x} ${control1.y} ${control2.x} ${control2.y} ${current.x} ${current.y}`,
      )
    } else if (command === OutlineCommand.CLOSE_PATH) parts.push('Z')
    else throw new Error(`Unknown outline command: ${command}`)
  }

  if (offset !== outline.coordinates.length) throw new Error('Unused glyph outline coordinates')
  return { controls, d: parts.join(' '), endpoints, handles }
}

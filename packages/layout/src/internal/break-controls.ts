const mandatoryControl = /[\n\v\f\r\u0085\u2028\u2029]/u

export function isMandatoryBreakControl(character: string): boolean {
  return mandatoryControl.test(character)
}

export function mandatoryLineBreakBoundaries(text: string): ReadonlySet<number> {
  const boundaries = new Set<number>()
  for (let position = 0; position < text.length; position += 1) {
    const character = text[position]
    if (!character || !isMandatoryBreakControl(character)) continue
    if (character === '\r' && text[position + 1] === '\n') position += 1
    boundaries.add(position + 1)
  }
  return boundaries
}

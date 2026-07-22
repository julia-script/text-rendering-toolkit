'use client'

import dynamic from 'next/dynamic'

const ColorGlyphExampleClient = dynamic(
  () => import('./color-glyph-example-client').then((module) => module.ColorGlyphExampleClient),
  { ssr: false },
)

export function ColorGlyphExample() {
  return <ColorGlyphExampleClient />
}

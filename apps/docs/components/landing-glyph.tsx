'use client'

import dynamic from 'next/dynamic'

const LandingGlyphClient = dynamic(
  () => import('./landing-glyph-client').then((module) => module.LandingGlyph),
  {
    loading: () => (
      <div className="type-specimen specimen-pending" aria-live="polite">
        <span>Generating outline…</span>
      </div>
    ),
    ssr: false,
  },
)

export function LandingGlyph() {
  return <LandingGlyphClient />
}

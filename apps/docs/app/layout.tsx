import { RootProvider } from 'fumadocs-ui/provider/next'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './global.css'

const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000')

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: 'WebGPU Text',
    template: '%s · WebGPU Text',
  },
  description:
    'Shape multilingual text, lay it out, generate CPU SDFs, and render with Three.js WebGPU.',
  openGraph: {
    title: 'WebGPU Text',
    description: 'Text, from bytes to pixels.',
    images: [{ url: '/og.png', width: 1731, height: 909 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WebGPU Text',
    description: 'Text, from bytes to pixels.',
    images: ['/og.png'],
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}

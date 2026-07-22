'use client'

import dynamic from 'next/dynamic'

const LayoutExampleClient = dynamic(
  () => import('./layout-example-client').then((module) => module.LayoutExampleClient),
  { ssr: false },
)

export function LayoutExample() {
  return <LayoutExampleClient />
}

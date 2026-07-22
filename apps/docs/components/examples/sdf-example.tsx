'use client'

import dynamic from 'next/dynamic'

const SdfExampleClient = dynamic(
  () => import('./sdf-example-client').then((module) => module.SdfExampleClient),
  { ssr: false },
)

export function SdfExample() {
  return <SdfExampleClient />
}

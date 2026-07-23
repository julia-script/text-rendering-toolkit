'use client'

import dynamic from 'next/dynamic'
import { ExampleFrame } from './example-frame'

const ThreeExampleClient = dynamic(
  () => import('./three-example-client').then((module) => module.ThreeExampleClient),
  { ssr: false },
)

export function ThreeExample() {
  return (
    <ExampleFrame title="Outline and drop shadow" status="Interactive">
      <ThreeExampleClient />
    </ExampleFrame>
  )
}

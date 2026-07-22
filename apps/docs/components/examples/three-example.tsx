'use client'

import dynamic from 'next/dynamic'
import { ExampleFrame } from './example-frame'

const ThreeExampleClient = dynamic(
  () => import('./three-example-client').then((module) => module.ThreeExampleClient),
  { ssr: false },
)

export function ThreeExample() {
  return (
    <ExampleFrame title="Three.js WebGPU text" status="WebGPU client island">
      <ThreeExampleClient />
    </ExampleFrame>
  )
}

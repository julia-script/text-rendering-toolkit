import { createMDX } from 'fumadocs-mdx/next'
import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    resolveAlias: {
      module: { browser: './lib/unavailable-node-module.ts' },
    },
  },
}

export default createMDX()(config)

import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'WebGPU Text',
      url: '/',
    },
    links: [
      {
        text: 'Pipeline',
        url: '/docs/concepts/pipeline',
      },
      {
        text: 'Examples',
        url: '/docs/examples/layout',
      },
    ],
    searchToggle: {
      enabled: true,
    },
  }
}

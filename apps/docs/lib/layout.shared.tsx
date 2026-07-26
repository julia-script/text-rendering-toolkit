import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'Text Rendering Toolkit',
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

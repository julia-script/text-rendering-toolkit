import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/**/*.unit.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'browser',
          include: ['test/**/*.browser.test.ts'],
          browser: {
            commands: {
              recordObservation(_context, observation: unknown) {
                console.info('WebGPU observation:', JSON.stringify(observation))
              },
            },
            enabled: true,
            provider: playwright({
              launchOptions: {
                args: ['--enable-unsafe-webgpu'],
                channel: 'chromium',
              },
            }),
            instances: [{ browser: 'chromium' }],
            headless: true,
          },
          testTimeout: 30_000,
        },
      },
    ],
  },
})

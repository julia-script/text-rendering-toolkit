import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const webgpuObservation = fileURLToPath(
  new URL('./artifacts/webgpu-observation.json', import.meta.url),
)
mkdirSync(fileURLToPath(new URL('./artifacts/', import.meta.url)), { recursive: true })

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
              recordDecorationObservation(_context, observation: unknown) {
                if (!observation || typeof observation !== 'object') {
                  throw new TypeError('decoration observation must be an object')
                }
                writeFileSync(webgpuObservation, `${JSON.stringify(observation, null, 2)}\n`)
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
          testTimeout: 60_000,
        },
      },
    ],
  },
})

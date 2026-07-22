import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const webgpuObservation = fileURLToPath(
  new URL('./artifacts/webgpu-observation.json', import.meta.url),
)
const browserObservation = fileURLToPath(
  new URL('./artifacts/browser-reference.json', import.meta.url),
)
const bridgeBrowserObservation = fileURLToPath(
  new URL('./artifacts/harfbuzz-bridge-browser.json', import.meta.url),
)

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
              recordColorGlyphObservation(_context, observation: unknown) {
                if (!observation || typeof observation !== 'object' || !('kind' in observation)) {
                  throw new TypeError('color-glyph observation must have a kind')
                }
                const target =
                  observation.kind === 'browser-color-font-reference'
                    ? browserObservation
                    : observation.kind === 'harfbuzz-color-bridge-browser'
                      ? bridgeBrowserObservation
                      : webgpuObservation
                writeFileSync(target, `${JSON.stringify(observation, null, 2)}\n`)
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

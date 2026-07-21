import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const productionFrame = fileURLToPath(
  new URL('./artifacts/three-webgpu-text-core.png', import.meta.url),
)
const productionObservation = fileURLToPath(
  new URL('./artifacts/three-webgpu-text-core.json', import.meta.url),
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
              recordObservation(_context, observation: unknown) {
                console.info('WebGPU observation:', JSON.stringify(observation))
                if (
                  observation &&
                  typeof observation === 'object' &&
                  'kind' in observation &&
                  observation.kind === 'three-webgpu-text-core'
                ) {
                  writeFileSync(
                    productionObservation,
                    `${JSON.stringify(
                      {
                        ...observation,
                        frameSha256: createHash('sha256')
                          .update(readFileSync(productionFrame))
                          .digest('hex'),
                      },
                      null,
                      2,
                    )}\n`,
                  )
                }
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

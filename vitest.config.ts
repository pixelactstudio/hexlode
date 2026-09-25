import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

import { browserMemory, writeReport } from './vitest.commands.ts'

const JSQUASH_PACKAGES = [
  '@jsquash/avif',
  '@jsquash/jpeg',
  '@jsquash/jxl',
  '@jsquash/oxipng',
  '@jsquash/png',
  '@jsquash/qoi',
  '@jsquash/resize',
  '@jsquash/webp',
]

export default defineConfig({
  resolve: { tsconfigPaths: true },
  optimizeDeps: { exclude: JSQUASH_PACKAGES },
  worker: { format: 'es' },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/__tests__/**/*.test.ts'],
          exclude: ['src/**/__tests__/**/*.browser.test.ts', 'src/**/__tests__/**/*.scale.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'scale',
          include: ['src/**/__tests__/**/*.scale.test.ts'],
          testTimeout: 60 * 60_000,
          browser: {
            enabled: true,
            headless: true,
            screenshotFailures: false,
            commands: {
              browserMemory: () => browserMemory(),
              writeReport,
            },
            provider: playwright({
              launchOptions: {
                executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
              },
            }),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/__tests__/**/*.browser.test.ts'],
          testTimeout: 60_000,
          browser: {
            enabled: true,
            headless: true,
            screenshotFailures: false,
            provider: playwright({
              launchOptions: {
                executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
              },
            }),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})

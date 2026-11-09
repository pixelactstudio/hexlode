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

type BrowserName = 'chromium' | 'firefox' | 'webkit'

/** Browsers for the browser and scale projects, from `VITEST_BROWSERS`. Chromium by default. */
const BROWSERS = (process.env.VITEST_BROWSERS ?? 'chromium')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean) as BrowserName[]

const browserInstances = BROWSERS.map((browser) => ({ browser }))

/**
 * Playwright's WebKit build fails every OPFS call with UnknownError, so a WebKit-only run skips
 * the suites that need OPFS. Chromium and Firefox run them; WebKit still runs codecs and metadata.
 */
const OPFS_SUITES = [
  'src/features/engine/__tests__/opfs.browser.test.ts',
  'src/features/engine/__tests__/pool-host.browser.test.ts',
  'src/features/runs/__tests__/run-controller.browser.test.ts',
  'src/features/studio/__tests__/studio-session.browser.test.ts',
]
const browserExclude = BROWSERS.join() === 'webkit' ? OPFS_SUITES : []

function browserProvider() {
  return playwright({
    launchOptions: {
      // A system Chromium, for machines where Playwright's own build does not run. The launch
      // options apply to every browser, so it is only used when Chromium runs alone.
      executablePath:
        BROWSERS.join() === 'chromium'
          ? process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
          : undefined,
    },
  })
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // libheif-js ships a CommonJS loader, which must be pre-bundled. Listing it keeps a first run from
  // finding it late and reloading the page while tests or the app are running.
  optimizeDeps: { exclude: JSQUASH_PACKAGES, include: ['libheif-js/libheif-wasm/libheif.js'] },
  worker: { format: 'es' },
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/__tests__/**',
        'src/routeTree.gen.ts',
        'src/features/theme/hexlode.js',
        'src/**/*.d.ts',
      ],
      reporter: ['text-summary', 'lcov', 'json-summary'],
      // Floors a few points under current coverage, so it cannot quietly drop. Raise them as it grows.
      thresholds: { statements: 55, branches: 40, functions: 45, lines: 55 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/__tests__/**/*.test.ts'],
          exclude: [
            'src/**/__tests__/**/*.browser.test.ts',
            'src/**/__tests__/**/*.scale.test.ts',
            'src/**/__tests__/**/*.e2e.test.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          // Drives the production build in Chromium through Playwright. Run `pnpm build` first.
          name: 'e2e',
          environment: 'node',
          include: ['src/**/__tests__/**/*.e2e.test.ts'],
          // Generous, so a busy machine slows the first visit's downloads without failing them.
          testTimeout: 180_000,
          hookTimeout: 300_000,
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
            provider: browserProvider(),
            instances: browserInstances,
          },
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/__tests__/**/*.browser.test.ts'],
          exclude: browserExclude,
          testTimeout: 60_000,
          browser: {
            enabled: true,
            headless: true,
            screenshotFailures: false,
            provider: browserProvider(),
            instances: browserInstances,
          },
        },
      },
    ],
  },
})

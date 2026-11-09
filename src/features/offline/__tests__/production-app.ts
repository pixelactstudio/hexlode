/**
 * The production build for end-to-end tests: the server started the way `pnpm start` starts it,
 * and Chromium, through Playwright, after one online visit that installs the service worker.
 * Run `pnpm build` first.
 */
import { type ChildProcess, spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Browser, type BrowserContext, chromium, type Page } from 'playwright'

export const ROOT = join(import.meta.dirname, '../../../..')
export const FIXTURES = join(ROOT, 'src/features/images/__tests__/fixtures')
const SERVER = join(ROOT, '.output/server/index.mjs')

async function waitForServer(base: string) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) return
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`The production server did not answer at ${base}.`)
}

export interface ProductionApp {
  base: string
  context: BrowserContext
  /** Opens a page in the app's browser context. */
  open(path: string): Promise<Page>
  close(): Promise<void>
}

/**
 * Starts the server and a browser, and visits the home page once online until the service
 * worker controls it. `prepare` runs in that first page, such as to save a pipeline tool.
 */
export async function startProductionApp(
  prepare: (page: Page) => Promise<void> = async () => {},
): Promise<ProductionApp> {
  if (!existsSync(SERVER)) throw new Error('Run pnpm build first: this test needs the build.')
  const port = 41_000 + Math.floor(Math.random() * 2000)
  const base = `http://localhost:${port}`
  let server: ChildProcess | undefined
  let browser: Browser | undefined
  const close = async () => {
    server?.kill()
    await browser?.close()
  }
  try {
    const started = spawn(
      process.execPath,
      ['--import', './.output/server/instrument.server.mjs', '.output/server/index.mjs'],
      { cwd: ROOT, env: { ...process.env, PORT: String(port), NODE_ENV: 'production' } },
    )
    server = started
    // Even if a timed-out hook never reaches close(), the server ends with the test process.
    process.once('exit', () => started.kill())
    await waitForServer(base)
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    })
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    await page.goto(`${base}/`)
    // The worker takes control once it has downloaded the whole build.
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
      timeout: 240_000,
    })
    await prepare(page)
    await page.close()
    const open = async (path: string) => {
      const next = await context.newPage()
      await next.goto(`${base}${path}`)
      return next
    }
    return { base, context, open, close }
  } catch (reason) {
    await close()
    throw reason
  }
}

/** Presses a tool page's run button, then Download, and returns the downloaded file. */
export async function runAndDownload(page: Page, runLabel: string) {
  await page.getByRole('button', { name: runLabel }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download', exact: true }).click()
  return new Uint8Array(readFileSync(await (await download).path()))
}

/** Whether the page shows this exact text somewhere visible. */
export function showsText(page: Page, text: string) {
  return page.getByText(text, { exact: true }).locator('visible=true').first().isVisible()
}

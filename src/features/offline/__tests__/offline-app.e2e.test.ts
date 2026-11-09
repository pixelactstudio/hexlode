/**
 * Exit gate for phase 5: the production build works offline after one online visit. Run
 * `pnpm build` first, then `pnpm test:e2e`.
 */
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { inspectImageHeader } from '#/features/image-input/validators'
import {
  FIXTURES,
  type ProductionApp,
  runAndDownload,
  startProductionApp,
  waitForHeading,
  waitForText,
} from '#/features/offline/__tests__/production-app'
import { SAVED_PIPELINES_KEY } from '#/features/pipelines/constants'
import { QUICK_TOOL_DEFINITIONS, quickToolPipeline } from '#/features/quick-tools/tools'

/** A pipeline tool saved in this browser, which the online visit never opens. */
const SAVED_TOOL = {
  id: 'offline-check',
  name: 'Offline check',
  pipeline: quickToolPipeline('convert', QUICK_TOOL_DEFINITIONS.convert.defaults),
  createdAt: 1,
  updatedAt: 1,
}

let app: ProductionApp

beforeAll(async () => {
  app = await startProductionApp((page) =>
    page.evaluate(
      ([key, value]) => localStorage.setItem(key, value),
      [SAVED_PIPELINES_KEY, JSON.stringify([SAVED_TOOL])],
    ),
  )
  await app.context.setOffline(true)
})

afterAll(() => app?.close())

describe('offline after one visit', () => {
  it('opens a quick tool it never showed and converts a photo with its codecs', async () => {
    const page = await app.open('/convert')
    await waitForHeading(page, 'Convert images')
    await waitForText(page, 'Offline')
    await page
      .locator('input[type=file][accept]')
      .first()
      .setInputFiles(join(FIXTURES, 'photo.jpg'))
    // JPEG in, WebP out: both codecs load from the cache, as neither was used online.
    const bytes = await runAndDownload(page, 'Convert 1 image')
    expect(inspectImageHeader(bytes.slice().buffer)).toMatchObject({
      format: 'webp',
      width: 48,
      height: 32,
    })
    await page.close()
  })

  it('opens the Studio', async () => {
    const page = await app.open('/studio')
    await waitForText(page, 'Web-ready photos')
    await page.close()
  })

  it('opens a saved pipeline tool from the app shell', async () => {
    const page = await app.open(`/tools/${SAVED_TOOL.id}`)
    await waitForHeading(page, SAVED_TOOL.name)
    await page.close()
  })

  it('keeps no copy of server routes', async () => {
    const page = await app.open('/')
    const cached = await page.evaluate(async () => {
      const urls: string[] = []
      for (const name of await caches.keys()) {
        for (const request of await (await caches.open(name)).keys()) urls.push(request.url)
      }
      return urls
    })
    expect(cached.length).toBeGreaterThan(50)
    expect(cached.filter((url) => new URL(url).pathname.startsWith('/api/'))).toEqual([])
    const health = await page.evaluate(() =>
      fetch('/api/health').then(
        (response) => response.status,
        () => 'offline',
      ),
    )
    expect(health).toBe('offline')
    await page.close()
  })
})

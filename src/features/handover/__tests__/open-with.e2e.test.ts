/**
 * Exit gate for phase 5: files from a share or a file launch land in the right page, with the
 * production build offline. Run `pnpm build` first, then `pnpm test:e2e`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { inspectImageHeader } from '#/features/image-input/validators'
import { readMetadata } from '#/features/images/metadata/containers'
import { parseExif } from '#/features/images/metadata/exif'
import { productRegistry } from '#/features/nodes/registry'
import {
  FIXTURES,
  type ProductionApp,
  runAndDownload,
  startProductionApp,
  waitForText,
} from '#/features/offline/__tests__/production-app'
import { exportPipelineFile } from '#/features/pipelines/pipeline-file'
import { availableTemplates } from '#/features/pipelines/templates'

let app: ProductionApp

beforeAll(async () => {
  app = await startProductionApp()
  await app.context.setOffline(true)
})

afterAll(() => app?.close())

interface LaunchedFile {
  name: string
  type: string
  bytes: number[]
}

/**
 * Opens `/open` the way the installed app does after a launch from the file manager. Headless
 * Chromium cannot install the app, so a stand-in for `window.launchQueue` hands over the files.
 */
async function launch(files: LaunchedFile[]) {
  const page = await app.context.newPage()
  await page.addInitScript((launched: LaunchedFile[]) => {
    const handles = launched.map(({ name, type, bytes }) => ({
      kind: 'file',
      name,
      getFile: async () => new File([new Uint8Array(bytes)], name, { type }),
    }))
    Object.defineProperty(window, 'launchQueue', {
      configurable: true,
      value: { setConsumer: (consumer: (params: unknown) => void) => consumer({ files: handles }) },
    })
  }, files)
  await page.goto(`${app.base}/open`)
  return page
}

describe('files opened from the file manager', () => {
  it('carry images into the tool the user picks', async () => {
    const photo = [...readFileSync(join(FIXTURES, 'photo.jpg'))]
    const page = await launch([{ name: 'photo.jpg', type: 'image/jpeg', bytes: photo }])
    await waitForText(page, 'photo.jpg')
    await page.getByRole('button', { name: /^Convert/ }).click()
    await page.waitForURL((url) => url.pathname === '/convert')
    const output = await runAndDownload(page, 'Convert 1 image')
    expect(inspectImageHeader(output.slice().buffer)).toMatchObject({ format: 'webp', width: 48 })
    await page.close()
  })

  it('open a .hexlode file in the Studio', async () => {
    const template = availableTemplates(productRegistry).find((t) => t.id === 'web-ready-photos')
    if (!template) throw new Error('The Web-ready photos template is missing.')
    const text = exportPipelineFile({ name: 'Shop photos', pipeline: template.pipeline })
    const page = await launch([
      { name: 'Shop-photos.hexlode', type: '', bytes: [...new TextEncoder().encode(text)] },
    ])
    await page.waitForURL((url) => url.pathname === '/studio')
    await waitForText(page, 'Shop photos')
    await page.close()
  })
})

describe('photos shared on Android', () => {
  it('open in Strip metadata, set to remove location only', async () => {
    const page = await app.open('/')
    const photo = [...readFileSync(join(FIXTURES, 'location.png'))]
    // What Android sends for a share: a multipart POST to the manifest's share target.
    await page.evaluate((bytes) => {
      const form = document.createElement('form')
      Object.assign(form, {
        method: 'POST',
        action: '/share-target',
        enctype: 'multipart/form-data',
      })
      const input = Object.assign(document.createElement('input'), { type: 'file', name: 'photos' })
      const transfer = new DataTransfer()
      transfer.items.add(new File([new Uint8Array(bytes)], 'location.png', { type: 'image/png' }))
      input.files = transfer.files
      form.append(input)
      document.body.append(form)
      form.submit()
    }, photo)
    await page.waitForURL((url) => url.pathname === '/strip-metadata' && url.search === '')
    await waitForText(page, 'location.png')
    expect(await page.getByRole('radio', { name: 'Only location' }).isChecked()).toBe(true)
    const output = await runAndDownload(page, 'Strip metadata from 1 image')
    expect(parseExif((await readMetadata('png', output)).exif)).toMatchObject({
      hasGps: false,
      make: 'Hexlode Test',
    })
    await page.close()
  })
})

describe('a share that reaches the server', () => {
  it('opens Strip metadata without keeping the photos', async () => {
    // Without the worker, as after the site's data was cleared, the share reaches the server.
    const form = new FormData()
    form.append('photos', new File([readFileSync(join(FIXTURES, 'location.png'))], 'location.png'))
    const response = await fetch(`${app.base}/share-target`, {
      method: 'POST',
      body: form,
      redirect: 'manual',
    })
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/strip-metadata')
  })
})

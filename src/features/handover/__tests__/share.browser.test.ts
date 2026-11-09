/**
 * Photos shared to the installed app on Android: the service worker receives the share and keeps
 * the photos in Cache Storage, and Strip metadata takes them, once, set to remove location only.
 */
import { afterEach, describe, expect, it } from 'vitest'

import { shareResponse, takeSharedPhotos } from '#/features/handover/share'
import { decodeFile, fixtureBytes, run } from '#/features/nodes/__tests__/harness'
import { OUTPUT_NODE_ID, quickToolPipeline } from '#/features/quick-tools/tools'

const ORIGIN = location.origin

async function photo(name: string) {
  return new File([await fixtureBytes(name)], name, { type: 'image/png', lastModified: 1234 })
}

/** The request Android sends when photos are shared to Hexlode. */
function share(...files: File[]) {
  const form = new FormData()
  for (const file of files) form.append('photos', file)
  form.append('title', 'Shared photos')
  return new Request(new URL('/share-target', ORIGIN), { method: 'POST', body: form })
}

afterEach(async () => {
  await caches.delete('hexlode-share')
})

describe('sharing photos to Hexlode', () => {
  it('opens Strip metadata once the worker has kept the photos', async () => {
    const response = await shareResponse(share(await photo('location.png')), caches)
    expect(response?.status).toBe(303)
    const target = new URL(response?.headers.get('location') ?? '')
    expect(target.pathname + target.search).toBe('/strip-metadata?shared=1')
  })

  it('hands the photos to the page once, then deletes them', async () => {
    const first = await photo('location.png')
    const second = await photo('photo.png')
    await shareResponse(share(first, second), caches)
    const taken = await takeSharedPhotos(caches)
    expect(taken?.files.map(({ file }) => [file.name, file.type, file.size])).toEqual([
      ['location.png', 'image/png', first.size],
      ['photo.png', 'image/png', second.size],
    ])
    const bytes = await taken?.files[0].file.arrayBuffer()
    expect(new Uint8Array(bytes ?? new ArrayBuffer(0))).toEqual(
      new Uint8Array(await first.arrayBuffer()),
    )
    expect(await takeSharedPhotos(caches)).toBeNull()
    expect(await caches.has('hexlode-share')).toBe(false)
  })

  it('replaces the photos of an earlier share nobody opened', async () => {
    await shareResponse(share(await photo('photo.png')), caches)
    await shareResponse(share(await photo('location.png')), caches)
    const taken = await takeSharedPhotos(caches)
    expect(taken?.files.map(({ file }) => file.name)).toEqual(['location.png'])
  })

  it('removes the location and keeps the rest of the metadata', async () => {
    await shareResponse(share(await photo('location.png')), caches)
    const taken = await takeSharedPhotos(caches)
    if (!taken) throw new Error('The share was not kept.')
    const inputs = await Promise.all(
      taken.files.map(async ({ file }) => ({
        name: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
      })),
    )
    const { files } = await run(quickToolPipeline('strip-metadata', taken.settings), inputs)
    const image = await decodeFile(files(OUTPUT_NODE_ID)[0].bytes)
    expect(image.exif).toMatchObject({
      hasGps: false,
      make: 'Hexlode Test',
      copyright: '(c) 2026 Ada Example',
    })
  })

  it('leaves every other request to the rest of the worker', async () => {
    expect(shareResponse(new Request(new URL('/share-target', ORIGIN)), caches)).toBeUndefined()
    const upload = new Request(new URL('/x7k2m9qa', ORIGIN), { method: 'POST', body: '{}' })
    expect(shareResponse(upload, caches)).toBeUndefined()
  })
})

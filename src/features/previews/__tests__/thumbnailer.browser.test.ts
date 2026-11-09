import { describe, expect, it } from 'vitest'

import { jsquashCodecs } from '#/features/images/codecs'
import { BLUE, fixtureBytes, near, RED } from '#/features/nodes/__tests__/harness'
import { createThumbnailer } from '#/features/previews/thumbnailer'

const createWorker = () =>
  new Worker(new URL('../thumbnail.worker.ts', import.meta.url), { type: 'module' })

async function decodeBlob(blob: Blob) {
  return jsquashCodecs.decode('png', new Uint8Array(await blob.arrayBuffer()))
}

function pixel(image: { data: Uint8ClampedArray; width: number }, x: number, y: number) {
  const offset = (y * image.width + x) * 4
  return Array.from(image.data.subarray(offset, offset + 4))
}

describe('previews of files the browser cannot show', () => {
  it('draws a HEIC photo upright, scaled to fit the edge', async () => {
    const thumbnailer = createThumbnailer(createWorker, { edge: 48 })
    const file = new Blob([await fixtureBytes('grid.heic')])
    const image = await decodeBlob(await thumbnailer.render(file, 'grid.heic'))
    // 64x96 upright, with red in the top right quarter.
    expect([image.width, image.height]).toEqual([32, 48])
    expect(near(pixel(image, 24, 12), RED)).toBe(true)
    expect(near(pixel(image, 8, 12), BLUE)).toBe(true)
    thumbnailer.dispose()
  })

  it('draws JPEG XL and QOI images, one after another', async () => {
    const thumbnailer = createThumbnailer(createWorker)
    const [jxl, qoi] = await Promise.all(
      ['photo.jxl', 'photo.qoi'].map(async (name) =>
        decodeBlob(await thumbnailer.render(new Blob([await fixtureBytes(name)]), name)),
      ),
    )
    for (const image of [jxl, qoi]) {
      expect([image.width, image.height]).toEqual([48, 32])
      expect(near(pixel(image, 4, 16), RED)).toBe(true)
    }
    thumbnailer.dispose()
  })

  it('says when a file cannot be drawn', async () => {
    const thumbnailer = createThumbnailer(createWorker)
    const file = new Blob([await fixtureBytes('malformed.heic')])
    await expect(thumbnailer.render(file, 'malformed.heic')).rejects.toThrow('could not be decoded')
    thumbnailer.dispose()
  })
})

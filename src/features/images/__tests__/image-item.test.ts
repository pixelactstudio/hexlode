import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ALL_IMAGE_TYPES } from '#/features/engine/item-types'
import { loadImageItem } from '#/features/images/image-item'
import { prepareSources } from '#/features/runs/sources'

function fixture(name: string) {
  return new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)))
}

/** The JPEG with filler APP15 segments after SOI, pushing its frame header past `bytes`. */
function jpegWithLargeHeader(bytes: number) {
  const jpeg = fixture('photo.jpg')
  const segment = new Uint8Array(0xffff + 2)
  segment.set([0xff, 0xef, 0xff, 0xff])
  const count = Math.ceil(bytes / segment.length)
  const padded = new Uint8Array(jpeg.length + count * segment.length)
  padded.set(jpeg.subarray(0, 2))
  for (let index = 0; index < count; index += 1) padded.set(segment, 2 + index * segment.length)
  padded.set(jpeg.subarray(2), 2 + count * segment.length)
  return padded
}

describe('loadImageItem', () => {
  it('loads a JPEG whose frame header comes after more than 1 MB of metadata', async () => {
    const bytes = jpegWithLargeHeader(1.5 * 1024 * 1024)
    const { sources } = await prepareSources(
      [{ file: new File([bytes], 'big.jpg'), relativePath: 'big.jpg' }],
      ALL_IMAGE_TYPES,
    )
    expect(sources).toHaveLength(1)
    const item = await loadImageItem(bytes, 'big.jpg')
    expect(item.meta).toMatchObject({ format: 'jpeg', width: 48, height: 32 })
  })
})

/**
 * HEIC decoding in a real browser. The fixtures are laid out as phones write photos: see
 * scripts/generate-fixtures.mjs.
 */
import { describe, expect, it } from 'vitest'

import { inspectImageHeader } from '#/features/image-input/validators'
import { DecodeError, jsquashCodecs } from '#/features/images/codecs'
import { BLUE, fixtureBytes, near, pixelAt, RED } from '#/features/nodes/__tests__/harness'

const GREEN = [0, 255, 0, 255]
const WHITE = [255, 255, 255, 255]

async function decode(name: string) {
  return { pixels: await jsquashCodecs.decode('heic', await fixtureBytes(name)) }
}

describe('HEIC decoding', () => {
  it('decodes a photo at its cropped size', async () => {
    const image = await decode('photo.heic')
    expect(image.pixels).toMatchObject({ width: 48, height: 32 })
    expect(near(pixelAt(image, 4, 16), RED)).toBe(true)
    expect(near(pixelAt(image, 44, 16), BLUE)).toBe(true)
  })

  it('turns a photo upright once, by its own rotation and not its EXIF tag', async () => {
    // Stored with red on the left and turned a quarter clockwise, so red ends up on top.
    const image = await decode('oriented.heic')
    expect(image.pixels).toMatchObject({ width: 32, height: 48 })
    expect(near(pixelAt(image, 16, 4), RED)).toBe(true)
    expect(near(pixelAt(image, 16, 44), BLUE)).toBe(true)
  })

  it('joins the tiles of a grid photo and turns it upright', async () => {
    // Stored as red, green / blue, white and turned a quarter clockwise.
    const image = await decode('grid.heic')
    expect(image.pixels).toMatchObject({ width: 64, height: 96 })
    expect(near(pixelAt(image, 16, 24), BLUE)).toBe(true)
    expect(near(pixelAt(image, 48, 24), RED)).toBe(true)
    expect(near(pixelAt(image, 16, 72), WHITE)).toBe(true)
    expect(near(pixelAt(image, 48, 72), GREEN)).toBe(true)
  })

  it('keeps transparency', async () => {
    const image = await decode('alpha.heic')
    expect(pixelAt(image, 24, 4)[3]).toBe(0)
    expect(near(pixelAt(image, 4, 28), RED, 64)).toBe(true)
  })

  it('decodes every fixture at the size its header reports', async () => {
    for (const name of ['photo.heic', 'oriented.heic', 'grid.heic', 'alpha.heic']) {
      const bytes = await fixtureBytes(name)
      const { width, height } = inspectImageHeader(bytes.slice().buffer)
      expect(await jsquashCodecs.decode('heic', bytes)).toMatchObject({ width, height })
    }
  })

  it('refuses a file whose image data is cut off', async () => {
    const bytes = await fixtureBytes('malformed.heic')
    await expect(jsquashCodecs.decode('heic', bytes)).rejects.toBeInstanceOf(DecodeError)
  })
})

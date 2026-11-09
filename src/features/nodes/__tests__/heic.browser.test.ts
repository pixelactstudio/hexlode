/**
 * HEIC photos through the engine: decoded once, turned upright exactly once, their metadata kept
 * or removed like any other format's, and saved as JPEG (or PNG, to keep transparency) when their
 * pixels changed, because Hexlode does not write HEIC.
 */
import { describe, expect, it } from 'vitest'

import {
  BLUE,
  chain,
  decodeFile,
  fixtureBytes,
  near,
  pixelAt,
  RED,
  run,
} from '#/features/nodes/__tests__/harness'

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length))

const SAVED_AS_JPEG = {
  code: 'heic_saved_as_jpeg',
  message: 'Hexlode does not write HEIC, so it saved a JPEG instead.',
}

describe('HEIC photos', () => {
  it('pass through unchanged when nothing changes their pixels', async () => {
    const { files, warnings } = await run(chain(['rename', { template: '{name}-copy' }]), [
      'grid.heic',
    ])
    expect(files().map(({ name }) => name)).toEqual(['grid-copy.heic'])
    expect(files()[0].bytes).toEqual(await fixtureBytes('grid.heic'))
    expect(warnings()).toEqual([])
  })

  it('convert to JPEG upright, with their location, colour profile and an upright tag', async () => {
    const { files } = await run(chain(['convert', { format: 'jpeg' }]), ['grid.heic'])
    const [file] = files()
    expect(file.name).toBe('grid.jpg')
    const image = await decodeFile(file.bytes)
    expect(image).toMatchObject({ format: 'jpeg', width: 64, height: 96 })
    // Turned a quarter clockwise from red, green / blue, white.
    expect(near(pixelAt(image, 48, 24), RED)).toBe(true)
    expect(near(pixelAt(image, 16, 24), BLUE)).toBe(true)
    // A viewer must not turn the upright pixels a second time.
    expect(image.exif).toMatchObject({
      orientation: 1,
      hasGps: true,
      copyright: '(c) 2026 Ada Example',
    })
    expect(image.metadata.icc?.length).toBe(480)
    expect(ascii(image.metadata.icc as Uint8Array, 36, 4)).toBe('acsp')
  })

  it('are already upright for Rotate’s auto mode, which leaves them as they are', async () => {
    const { files, statuses } = await run(chain(['rotate', { auto: true }]), ['oriented.heic'])
    expect(statuses('rotate-1')).toEqual(['processed'])
    expect(files()[0].bytes).toEqual(await fixtureBytes('oriented.heic'))
  })

  it('turn by quarter turns from how they show, not how they are stored', async () => {
    const { files } = await run(chain(['rotate', { auto: true, rotate: 90 }]), ['oriented.heic'])
    const image = await decodeFile(files()[0].bytes)
    // Upright it is 32x48 with red on top; a quarter turn clockwise puts red on the right.
    expect(image).toMatchObject({ format: 'jpeg', width: 48, height: 32 })
    expect(near(pixelAt(image, 44, 16), RED)).toBe(true)
    expect(near(pixelAt(image, 4, 16), BLUE)).toBe(true)
  })

  it('crop from the upright photo', async () => {
    const { files } = await run(chain(['crop', { aspect: '1:1', position: 'top' }]), [
      'oriented.heic',
    ])
    const image = await decodeFile(files()[0].bytes)
    expect(image).toMatchObject({ format: 'jpeg', width: 32, height: 32 })
    expect(near(pixelAt(image, 16, 4), RED)).toBe(true)
    expect(near(pixelAt(image, 16, 28), BLUE)).toBe(true)
    expect(image.exif.orientation).toBe(1)
  })

  it('are saved as JPEG with a warning when their pixels changed and nothing encodes them', async () => {
    const { files, warnings } = await run(chain(['resize', { mode: 'width', width: 24 }]), [
      'photo.heic',
    ])
    const [file] = files()
    expect(file.name).toBe('photo.jpg')
    const image = await decodeFile(file.bytes)
    expect(image).toMatchObject({ format: 'jpeg', width: 24, height: 16 })
    expect(near(pixelAt(image, 2, 8), RED)).toBe(true)
    expect(image.exif).toMatchObject({ hasGps: true, artist: 'Ada Example' })
    expect(warnings()).toEqual([SAVED_AS_JPEG])
  })

  it('are saved as PNG instead when they have transparency', async () => {
    const { files, warnings } = await run(chain(['resize', { mode: 'width', width: 24 }]), [
      'alpha.heic',
    ])
    const [file] = files()
    expect(file.name).toBe('alpha.png')
    const image = await decodeFile(file.bytes)
    expect(image).toMatchObject({ format: 'png', width: 24, height: 16 })
    expect(pixelAt(image, 12, 2)[3]).toBe(0)
    expect(near(pixelAt(image, 2, 14), RED, 64)).toBe(true)
    expect(warnings()).toEqual([
      {
        code: 'heic_saved_as_png',
        message: 'Hexlode does not write HEIC, so it saved a PNG instead, to keep transparency.',
      },
    ])
  })

  it('keep their format and pixels when Strip metadata removes their location', async () => {
    const { files } = await run(chain(['strip-metadata', { mode: 'location' }]), ['photo.heic'])
    const [file] = files()
    expect(file.name).toBe('photo.heic')
    const image = await decodeFile(file.bytes)
    expect(image).toMatchObject({ format: 'heic', width: 48, height: 32 })
    expect(image.exif).toMatchObject({ hasGps: false, copyright: '(c) 2026 Ada Example' })
    const source = await decodeFile(await fixtureBytes('photo.heic'))
    expect(image.pixels.data).toEqual(source.pixels.data)
  })

  it('keep only their copyright when Strip metadata says so', async () => {
    const { files } = await run(chain(['strip-metadata', { mode: 'copyright' }]), ['grid.heic'])
    const image = await decodeFile(files()[0].bytes)
    expect(image.exif).toMatchObject({
      copyright: '(c) 2026 Ada Example',
      artist: null,
      make: null,
      hasGps: false,
    })
  })

  it('show their format, size, location and colour profile in Inspect', async () => {
    const { records } = await run(chain(['inspect']), ['grid.heic'])
    expect(records('inspect-1')[0].fields).toMatchObject({
      format: 'HEIC',
      width: 64,
      height: 96,
      location: 'Yes',
      colourProfile: 'Yes',
      orientation: 1,
      camera: 'Hexlode Test',
    })
  })

  it('become JPEG when Convert keeps each format', async () => {
    const { files, warnings } = await run(chain(['convert', { format: 'original' }]), [
      'photo.heic',
      'photo.png',
    ])
    expect(files().map(({ name }) => name)).toEqual(['photo.jpg', 'photo.png'])
    expect((await decodeFile(files()[0].bytes)).format).toBe('jpeg')
    expect(warnings()).toEqual([SAVED_AS_JPEG])
  })

  it('compress to a target size as JPEG', async () => {
    const { files, statuses } = await run(
      chain(['compress-to-size', { format: 'original', targetKilobytes: 1 }]),
      ['photo.heic'],
    )
    expect(statuses('compress-to-size-1')).toEqual(['processed'])
    const [file] = files()
    expect(file.name).toBe('photo.jpg')
    expect(file.bytes.length).toBeLessThanOrEqual(1024)
    expect(await decodeFile(file.bytes)).toMatchObject({ format: 'jpeg', width: 48, height: 32 })
  })

  it('fail alone when their image data is damaged', async () => {
    const { statuses, files } = await run(chain(['convert', { format: 'png' }]), [
      'photo.heic',
      'malformed.heic',
    ])
    expect(statuses('convert-1')).toEqual(['processed', 'failed'])
    expect(files().map(({ name }) => name)).toEqual(['photo.png'])
  })
})

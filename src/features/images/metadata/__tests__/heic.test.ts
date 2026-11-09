import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { inspectImageHeader } from '#/features/image-input/validators'
import { readMetadata, writeMetadata } from '#/features/images/metadata/containers'
import { parseExif } from '#/features/images/metadata/exif'
import { stripMetadata } from '#/features/images/metadata/strip'

function fixture(name: string) {
  return new Uint8Array(readFileSync(new URL(`../../__tests__/fixtures/${name}`, import.meta.url)))
}

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length))

/** What the fixture generator writes into the photo fixtures' EXIF. */
const EXPECTED = {
  make: 'Hexlode Test',
  artist: 'Ada Example',
  copyright: '(c) 2026 Ada Example',
  dateTaken: '2026:01:02 03:04:05',
  hasGps: true,
  location: { latitude: 51.5, longitude: -7 / 60 },
}

describe('HEIC metadata', () => {
  it('reads EXIF with location from its own item', async () => {
    const metadata = await readMetadata('heic', fixture('photo.heic'))
    expect(parseExif(metadata.exif)).toMatchObject({ ...EXPECTED, orientation: 1 })
    expect(metadata.icc).toBeUndefined()
  })

  it('reads the Display P3 colour profile of a tiled photo', async () => {
    const { icc, exif } = await readMetadata('heic', fixture('grid.heic'))
    expect(icc?.length).toBe(480)
    expect(ascii(icc as Uint8Array, 36, 4)).toBe('acsp')
    expect(ascii(icc as Uint8Array, 12, 8)).toBe('mntrRGB ')
    expect(parseExif(exif)).toMatchObject(EXPECTED)
  })

  it('resets the EXIF orientation, because decoding applies the file’s own rotation', async () => {
    // The files say 6, like phone photos, and also carry an `irot` quarter turn.
    for (const name of ['oriented.heic', 'grid.heic']) {
      const { exif } = await readMetadata('heic', fixture(name))
      expect(parseExif(exif).orientation).toBe(1)
      expect(parseExif(exif).dateTaken).toBe(EXPECTED.dateTaken)
    }
  })

  it('finds no metadata in a file without any', async () => {
    expect(await readMetadata('heic', fixture('alpha.heic'))).toEqual({})
  })

  it('removes location in place and keeps the rest of the file', async () => {
    const source = fixture('photo.heic')
    const stripped = stripMetadata(await readMetadata('heic', source), {
      mode: 'location',
      keepColourProfile: true,
    })
    const { bytes, dropped } = await writeMetadata('heic', source, stripped)
    expect(dropped).toEqual([])
    expect(bytes.length).toBe(source.length)
    expect(parseExif((await readMetadata('heic', bytes)).exif)).toMatchObject({
      copyright: EXPECTED.copyright,
      hasGps: false,
      location: null,
    })
    expect(inspectImageHeader(bytes.slice().buffer)).toMatchObject({
      format: 'heic',
      width: 48,
      height: 32,
    })
    const bare = await writeMetadata('heic', source, {})
    expect(await readMetadata('heic', bare.bytes)).toEqual({})
  })

  it('keeps the colour profile in place, since it describes the coded image', async () => {
    const source = fixture('grid.heic')
    const metadata = await readMetadata('heic', source)
    const kept = await writeMetadata('heic', source, { icc: metadata.icc })
    expect(kept.dropped).toEqual([])
    expect(await readMetadata('heic', kept.bytes)).toEqual({ icc: metadata.icc })
  })

  it('cannot add metadata the file has no room for', async () => {
    const exif = (await readMetadata('heic', fixture('photo.heic'))).exif
    const { dropped } = await writeMetadata('heic', fixture('alpha.heic'), {
      exif,
      icc: Uint8Array.from([1, 2, 3]),
    })
    expect(dropped).toEqual(['icc', 'exif'])
  })
})

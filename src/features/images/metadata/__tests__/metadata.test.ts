import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { inspectImageHeader } from '#/features/image-input/validators'
import { readMetadata, writeMetadata } from '#/features/images/metadata/containers'
import { parseExif, setExifOrientation } from '#/features/images/metadata/exif'
import { stripMetadata } from '#/features/images/metadata/strip'

function fixture(name: string) {
  return new Uint8Array(readFileSync(new URL(`../../__tests__/fixtures/${name}`, import.meta.url)))
}

const EXPECTED = {
  make: 'Hexlode Test',
  artist: 'Ada Example',
  copyright: '(c) 2026 Ada Example',
  dateTaken: '2026:01:02 03:04:05',
  orientation: 1,
  location: { latitude: 51.5, longitude: -7 / 60 },
}

/** Everything from the start-of-scan marker on: the compressed image data. */
function jpegScan(bytes: Uint8Array) {
  for (let index = 2; index < bytes.length - 1; index += 1) {
    if (bytes[index] === 0xff && bytes[index + 1] === 0xda) return bytes.slice(index)
  }
  throw new Error('No scan')
}

describe('readMetadata', () => {
  it('reads EXIF fields and location from a JPEG', async () => {
    const metadata = await readMetadata('jpeg', fixture('photo.jpg'))
    expect(parseExif(metadata.exif)).toMatchObject(EXPECTED)
  })

  it('reads the camera orientation tag', async () => {
    const metadata = await readMetadata('jpeg', fixture('oriented.jpg'))
    expect(parseExif(metadata.exif)).toMatchObject({ orientation: 6, location: null })
  })

  it('reads EXIF from a PNG eXIf chunk', async () => {
    const metadata = await readMetadata('png', fixture('location.png'))
    expect(parseExif(metadata.exif)).toMatchObject(EXPECTED)
  })

  it('finds no metadata in files without any', async () => {
    for (const [format, name] of [
      ['png', 'photo.png'],
      ['webp', 'photo.webp'],
      ['jxl', 'photo.jxl'],
      ['avif', 'photo.avif'],
      ['qoi', 'photo.qoi'],
    ] as const) {
      expect(await readMetadata(format, fixture(name))).toEqual({})
    }
  })
})

describe('stripMetadata', () => {
  it('removes only location data', async () => {
    const metadata = await readMetadata('jpeg', fixture('photo.jpg'))
    const stripped = stripMetadata(metadata, { mode: 'location', keepColourProfile: true })
    expect(parseExif(stripped.exif)).toMatchObject({ ...EXPECTED, location: null, hasGps: false })
  })

  it('keeps only copyright', async () => {
    const metadata = await readMetadata('jpeg', fixture('photo.jpg'))
    const stripped = stripMetadata(metadata, { mode: 'copyright', keepColourProfile: true })
    expect(parseExif(stripped.exif)).toMatchObject({
      copyright: EXPECTED.copyright,
      make: null,
      artist: null,
      dateTaken: null,
      location: null,
    })
  })

  it('removes everything, and the colour profile unless asked to keep it', () => {
    const icc = Uint8Array.from([1, 2, 3])
    const metadata = { exif: Uint8Array.from([1]), xmp: '<x/>', icc }
    expect(stripMetadata(metadata, { mode: 'all', keepColourProfile: true })).toEqual({ icc })
    expect(stripMetadata(metadata, { mode: 'all', keepColourProfile: false })).toEqual({})
  })

  it('keeps a camera orientation so stripped photos still display upright', async () => {
    const metadata = await readMetadata('jpeg', fixture('oriented.jpg'))
    const stripped = stripMetadata(metadata, { mode: 'all', keepColourProfile: true })
    expect(parseExif(stripped.exif)).toMatchObject({ orientation: 6, make: null, artist: null })
  })

  it('removes location properties from XMP', () => {
    const xmp =
      '<rdf:Description exif:GPSLatitude="51,30N" exif:GPSLongitude="0,7W" dc:format="image/jpeg"><photoshop:City>London</photoshop:City><dc:rights>(c) Ada</dc:rights></rdf:Description>'
    const location = stripMetadata({ xmp }, { mode: 'location', keepColourProfile: true }).xmp
    expect(location).not.toMatch(/GPS|London/)
    expect(location).toContain('dc:format="image/jpeg"')
    const copyright = stripMetadata({ xmp }, { mode: 'copyright', keepColourProfile: true }).xmp
    expect(copyright).toContain('<dc:rights>(c) Ada</dc:rights>')
    expect(copyright).not.toContain('image/jpeg')
  })
})

describe('writeMetadata', () => {
  it('rewrites JPEG metadata without touching the compressed image', async () => {
    const source = fixture('photo.jpg')
    const metadata = await readMetadata('jpeg', source)
    const stripped = stripMetadata(metadata, { mode: 'location', keepColourProfile: true })
    const { bytes, dropped } = await writeMetadata('jpeg', source, stripped)
    expect(dropped).toEqual([])
    expect(jpegScan(bytes)).toEqual(jpegScan(source))
    expect(parseExif((await readMetadata('jpeg', bytes)).exif)).toMatchObject({ location: null })
    const bare = await writeMetadata('jpeg', source, {})
    expect(await readMetadata('jpeg', bare.bytes)).toEqual({})
  })

  it.each([
    ['png', 'photo.png'],
    ['webp', 'photo.webp'],
    ['webp', 'alpha.webp'],
    ['jxl', 'photo.jxl'],
  ] as const)('adds EXIF, XMP and a colour profile to %s (%s)', async (format, name) => {
    const exif = (await readMetadata('jpeg', fixture('photo.jpg'))).exif
    const icc = Uint8Array.from({ length: 300 }, (_, index) => index % 251)
    const xmp = '<x:xmpmeta xmlns:x="adobe:ns:meta/"><dc:rights>(c) Ada</dc:rights></x:xmpmeta>'
    const withIcc = format !== 'jxl'
    const { bytes, dropped } = await writeMetadata(format, fixture(name), {
      exif,
      xmp,
      ...(withIcc ? { icc } : {}),
    })
    expect(dropped).toEqual([])
    const read = await readMetadata(format, bytes)
    expect(parseExif(read.exif)).toMatchObject(EXPECTED)
    expect(read.xmp).toBe(xmp)
    if (withIcc) expect(read.icc).toEqual(icc)
    expect(inspectImageHeader(bytes.slice().buffer)).toMatchObject({
      format,
      width: 48,
      height: 32,
    })
  })

  it('reports what AVIF and QOI cannot keep', async () => {
    const exif = (await readMetadata('jpeg', fixture('photo.jpg'))).exif
    expect((await writeMetadata('avif', fixture('photo.avif'), { exif })).dropped).toEqual(['exif'])
    expect(
      (await writeMetadata('qoi', fixture('photo.qoi'), { exif, xmp: '<x/>' })).dropped,
    ).toEqual(['exif', 'xmp'])
  })

  it('sets the orientation tag in place', async () => {
    const metadata = await readMetadata('jpeg', fixture('oriented.jpg'))
    expect(parseExif(setExifOrientation(metadata.exif as Uint8Array, 1)).orientation).toBe(1)
  })
})

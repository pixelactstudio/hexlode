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

/** RIFF chunks of a WebP file, as [type, data]. */
function webpChunks(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const found: [string, Uint8Array][] = []
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const length = view.getUint32(offset + 4, true)
    found.push([
      String.fromCharCode(...bytes.subarray(offset, offset + 4)),
      bytes.slice(offset + 8, offset + 8 + length),
    ])
    offset += 8 + length + (length % 2)
  }
  return found
}

function riff(chunks: [string, Uint8Array][]) {
  const parts = chunks.flatMap(([type, data]) => {
    const head = new Uint8Array(8)
    head.set([...type].map((c) => c.charCodeAt(0)))
    new DataView(head.buffer).setUint32(4, data.length, true)
    return [head, data, new Uint8Array(data.length % 2)]
  })
  const body = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 4))
  body.set([0x57, 0x45, 0x42, 0x50])
  let at = 4
  for (const part of parts) {
    body.set(part, at)
    at += part.length
  }
  const file = new Uint8Array(8 + body.length)
  file.set([0x52, 0x49, 0x46, 0x46])
  new DataView(file.buffer).setUint32(4, body.length, true)
  file.set(body, 8)
  return file
}

const u24 = (value: number) => [value & 0xff, (value >> 8) & 0xff, value >> 16]

/** A two-frame animated WebP of the 48 × 32 fixture, with EXIF. */
function animatedWebp(exif: Uint8Array) {
  const [[, vp8]] = webpChunks(fixture('photo.webp'))
  const frameChunk = riff([['VP8 ', vp8]]).subarray(12)
  const frame = Uint8Array.from([
    ...u24(0),
    ...u24(0),
    ...u24(47),
    ...u24(31),
    ...u24(100),
    0,
    ...frameChunk,
  ])
  return riff([
    ['VP8X', Uint8Array.from([0x02 | 0x08, 0, 0, 0, ...u24(47), ...u24(31)])],
    ['ANIM', Uint8Array.from([0, 0, 0, 0, 0, 0])],
    ['ANMF', frame],
    ['ANMF', frame],
    ['EXIF', exif],
  ])
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

  it('rewrites metadata on an animated WebP and keeps its frames', async () => {
    const exif = (await readMetadata('jpeg', fixture('photo.jpg'))).exif as Uint8Array
    const animated = animatedWebp(exif)
    const frames = webpChunks(animated).filter(([type]) => type === 'ANMF')
    const stripped = await writeMetadata('webp', animated, {})
    expect(await readMetadata('webp', stripped.bytes)).toEqual({})
    const chunks = webpChunks(stripped.bytes)
    expect(chunks.map(([type]) => type)).toEqual(['VP8X', 'ANIM', 'ANMF', 'ANMF'])
    expect(chunks[0][1][0]).toBe(0x02)
    expect(chunks.filter(([type]) => type === 'ANMF')).toEqual(frames)
    expect(inspectImageHeader(stripped.bytes.slice().buffer)).toMatchObject({
      format: 'webp',
      width: 48,
      height: 32,
    })
    const tagged = await writeMetadata('webp', stripped.bytes, { exif })
    expect(parseExif((await readMetadata('webp', tagged.bytes)).exif)).toMatchObject(EXPECTED)
    expect(webpChunks(tagged.bytes)[0][1][0]).toBe(0x02 | 0x08)
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

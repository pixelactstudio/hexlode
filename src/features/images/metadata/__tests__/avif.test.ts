import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { readMetadata, writeMetadata } from '#/features/images/metadata/containers'
import { parseExif } from '#/features/images/metadata/exif'
import { stripMetadata } from '#/features/images/metadata/strip'

const tiff = exifFromJpegFixture('photo.jpg')

function exifFromJpegFixture(name: string) {
  // The JPEG fixture's APP1 segment holds the TIFF block right after "Exif\0\0".
  const bytes = new Uint8Array(
    readFileSync(new URL(`../../__tests__/fixtures/${name}`, import.meta.url)),
  )
  const start = bytes.indexOf(0x45, 4) // "E" of "Exif"
  const length = (bytes[start - 2] << 8) | bytes[start - 1]
  return bytes.slice(start + 6, start - 2 + length)
}

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0))
const u16 = (v: number) => [v >> 8, v & 0xff]
const u32 = (v: number) => [v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]
const box = (type: string, body: number[]) => [...u32(8 + body.length), ...ascii(type), ...body]
const fullBox = (type: string, version: number, body: number[]) =>
  box(type, [version, 0, 0, 0, ...body])

/** ftyp, meta (hdlr, iinf with an Exif and an XMP item, iloc) and mdat, built by hand. */
function avifWithMetadata(exif: Uint8Array, xmp: string) {
  const exifPayload = [...u32(0), ...exif]
  const xmpPayload = ascii(xmp)
  const infe = (id: number, type: string, extra: number[] = []) =>
    fullBox('infe', 2, [...u16(id), ...u16(0), ...ascii(type), 0, ...extra])
  const iinf = fullBox('iinf', 0, [
    ...u16(2),
    ...infe(1, 'Exif'),
    ...infe(2, 'mime', [...ascii('application/rdf+xml'), 0]),
  ])
  const ftyp = box('ftyp', [...ascii('avif'), ...u32(0), ...ascii('avifmif1')])
  const build = (mdatStart: number) => {
    const iloc = fullBox('iloc', 0, [
      0x44,
      0x00,
      ...u16(2),
      ...u16(1),
      ...u16(0),
      ...u16(1),
      ...u32(mdatStart + 8),
      ...u32(exifPayload.length),
      ...u16(2),
      ...u16(0),
      ...u16(1),
      ...u32(mdatStart + 8 + exifPayload.length),
      ...u32(xmpPayload.length),
    ])
    const hdlr = fullBox('hdlr', 0, [
      ...u32(0),
      ...ascii('pict'),
      ...u32(0),
      ...u32(0),
      ...u32(0),
      0,
    ])
    return [...ftyp, ...fullBox('meta', 0, [...hdlr, ...iinf, ...iloc])]
  }
  const head = build(0)
  const withOffsets = build(head.length)
  return Uint8Array.from([...withOffsets, ...box('mdat', [...exifPayload, ...xmpPayload])])
}

const XMP =
  '<x:xmpmeta><rdf:Description exif:GPSLatitude="51,30N"><dc:rights>(c) Ada</dc:rights></rdf:Description></x:xmpmeta>'

describe('AVIF metadata', () => {
  it('reads EXIF and XMP items', async () => {
    const metadata = await readMetadata('avif', avifWithMetadata(tiff, XMP))
    expect(parseExif(metadata.exif)).toMatchObject({
      copyright: '(c) 2026 Ada Example',
      hasGps: true,
    })
    expect(metadata.xmp).toBe(XMP)
  })

  it('removes metadata in place so none of it stays in the file', async () => {
    const file = avifWithMetadata(tiff, XMP)
    const { bytes, dropped } = await writeMetadata('avif', file, {})
    expect(dropped).toEqual([])
    expect(bytes.length).toBe(file.length)
    expect(await readMetadata('avif', bytes)).toEqual({})
    const text = new TextDecoder('latin1').decode(bytes)
    expect(text).not.toContain('Ada Example')
    expect(text).not.toContain('GPSLatitude')
  })

  it('removes only location, keeping the rest', async () => {
    const file = avifWithMetadata(tiff, XMP)
    const stripped = stripMetadata(await readMetadata('avif', file), {
      mode: 'location',
      keepColourProfile: true,
    })
    const { bytes } = await writeMetadata('avif', file, stripped)
    const read = await readMetadata('avif', bytes)
    expect(parseExif(read.exif)).toMatchObject({ copyright: '(c) 2026 Ada Example', hasGps: false })
    expect(read.xmp).not.toContain('GPS')
    expect(read.xmp).toContain('(c) Ada')
  })
})

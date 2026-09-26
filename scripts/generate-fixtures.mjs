/**
 * Generates the image fixtures in src/features/images/__tests__/fixtures.
 * Run with `node scripts/generate-fixtures.mjs`. The EXIF blocks are assembled byte by byte here,
 * independently of the app's metadata code, so tests can check that code against them.
 *
 * Every image is 48x32: the left half red, the right half blue. Images with alpha have a fully
 * transparent top half.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'src/features/images/__tests__/fixtures')
const wasm = async (path) => WebAssembly.compile(await readFile(join(root, 'node_modules', path)))

globalThis.ImageData ??= class ImageData {
  constructor(data, width, height) {
    this.data = data
    this.width = width
    this.height = height
  }
}

const WIDTH = 48
const HEIGHT = 32

function pixels({ alpha = false } = {}) {
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4)
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const offset = (y * WIDTH + x) * 4
      const red = x < WIDTH / 2
      data[offset] = red ? 255 : 0
      data[offset + 1] = 0
      data[offset + 2] = red ? 0 : 255
      data[offset + 3] = alpha && y < HEIGHT / 2 ? 0 : 255
    }
  }
  return new ImageData(data, WIDTH, HEIGHT)
}

/** A little-endian TIFF block with IFD0, an Exif IFD and optionally a GPS IFD. */
function exif({ orientation = 1, gps = true } = {}) {
  const ascii = (text) => [...new TextEncoder().encode(text), 0]
  const ifd0 = [
    [0x010f, 2, ascii('Hexlode Test')],
    [0x0112, 3, [orientation]],
    [0x013b, 2, ascii('Ada Example')],
    [0x8298, 2, ascii('(c) 2026 Ada Example')],
    [0x8769, 4, 'exif'],
    ...(gps ? [[0x8825, 4, 'gps']] : []),
  ]
  const exifIfd = [[0x9003, 2, ascii('2026:01:02 03:04:05')]]
  const gpsIfd = [
    [0x0000, 1, [2, 3, 0, 0]],
    [0x0001, 2, ascii('N')],
    [0x0002, 5, [51, 1, 30, 1, 0, 1]],
    [0x0003, 2, ascii('W')],
    [0x0004, 5, [0, 1, 7, 1, 0, 1]],
  ]
  const sizes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 4 }
  const bytes = []
  const u16 = (value) => [value & 0xff, value >> 8]
  const u32 = (value) => [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, value >>> 24]

  const layout = (entries, start) => 2 + entries.length * 12 + 4 + start
  const offsets = {}
  offsets.ifd0 = 8
  let cursor = layout(ifd0, 8)
  const dataFor = new Map()
  const place = (entries) => {
    for (const entry of entries) {
      const [, type, values] = entry
      if (typeof values === 'string') continue
      const length = type === 5 ? (values.length / 2) * 8 : values.length * sizes[type]
      if (length > 4) {
        dataFor.set(entry, cursor)
        cursor += length + (length % 2)
      }
    }
  }
  place(ifd0)
  offsets.exif = cursor
  cursor = layout(exifIfd, cursor)
  place(exifIfd)
  offsets.gps = cursor
  if (gps) {
    cursor = layout(gpsIfd, cursor)
    place(gpsIfd)
  }
  const total = cursor
  const buffer = new Uint8Array(total)
  const write = (at, values) => buffer.set(values, at)
  write(0, [0x49, 0x49, 0x2a, 0x00, ...u32(8)])

  const encodeValues = (type, values) => {
    if (type === 1 || type === 2) return values
    if (type === 3) return values.flatMap(u16)
    if (type === 4) return values.flatMap(u32)
    return values.flatMap(u32)
  }
  const writeIfd = (entries, at) => {
    write(at, u16(entries.length))
    entries.forEach((entry, index) => {
      const [tag, type, values] = entry
      const base = at + 2 + index * 12
      if (typeof values === 'string') {
        write(base, [...u16(tag), ...u16(4), ...u32(1), ...u32(offsets[values])])
        return
      }
      const count = type === 5 ? values.length / 2 : values.length
      const encoded = encodeValues(type, values)
      write(base, [...u16(tag), ...u16(type), ...u32(count)])
      if (encoded.length > 4) {
        write(base + 8, u32(dataFor.get(entry)))
        write(dataFor.get(entry), encoded)
      } else {
        write(base + 8, [...encoded, 0, 0, 0, 0].slice(0, 4))
      }
    })
    write(at + 2 + entries.length * 12, u32(0))
  }
  writeIfd(ifd0, offsets.ifd0)
  writeIfd(exifIfd, offsets.exif)
  if (gps) writeIfd(gpsIfd, offsets.gps)
  bytes.push(...buffer)
  return Uint8Array.from(bytes)
}

function jpegWithExif(jpeg, tiff) {
  const input = new Uint8Array(jpeg)
  const payload = [...new TextEncoder().encode('Exif'), 0, 0, ...tiff]
  const length = payload.length + 2
  const segment = [0xff, 0xe1, length >> 8, length & 0xff, ...payload]
  return Uint8Array.from([...input.slice(0, 2), ...segment, ...input.slice(2)])
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function pngWithExif(png, tiff) {
  const input = new Uint8Array(png)
  const type = new TextEncoder().encode('eXIf')
  const length = tiff.length
  const crc = crc32([...type, ...tiff])
  const chunk = [
    length >>> 24,
    (length >> 16) & 0xff,
    (length >> 8) & 0xff,
    length & 0xff,
    ...type,
    ...tiff,
    crc >>> 24,
    (crc >> 16) & 0xff,
    (crc >> 8) & 0xff,
    crc & 0xff,
  ]
  // After the signature (8) and IHDR chunk (25).
  return Uint8Array.from([...input.slice(0, 33), ...chunk, ...input.slice(33)])
}

const jpegEncode = await import('@jsquash/jpeg/encode.js')
await jpegEncode.init(await wasm('@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm'))
const pngEncode = await import('@jsquash/png/encode.js')
await pngEncode.init(await wasm('@jsquash/png/codec/pkg/squoosh_png_bg.wasm'))
const webpEncode = await import('@jsquash/webp/encode.js')
await webpEncode.init(await wasm('@jsquash/webp/codec/enc/webp_enc.wasm'))
const avifEncode = await import('@jsquash/avif/encode.js')
await avifEncode.init(await wasm('@jsquash/avif/codec/enc/avif_enc.wasm'))
const jxlEncode = await import('@jsquash/jxl/encode.js')
await jxlEncode.init(await wasm('@jsquash/jxl/codec/enc/jxl_enc.wasm'))
const qoiEncode = await import('@jsquash/qoi/encode.js')
await qoiEncode.init(await wasm('@jsquash/qoi/codec/enc/qoi_enc.wasm'))

await mkdir(out, { recursive: true })
const save = (name, bytes) => writeFile(join(out, name), new Uint8Array(bytes))

const jpeg = await jpegEncode.default(pixels(), { quality: 90 })
await save('photo.jpg', jpegWithExif(jpeg, exif()))
await save('oriented.jpg', jpegWithExif(jpeg, exif({ orientation: 6, gps: false })))
await save('plain.jpg', jpeg)
const png = await pngEncode.default(pixels())
await save('photo.png', png)
await save('location.png', pngWithExif(png, exif()))
await save('alpha.png', await pngEncode.default(pixels({ alpha: true })))
await save('photo.webp', await webpEncode.default(pixels(), { quality: 90 }))
await save('alpha.webp', await webpEncode.default(pixels({ alpha: true }), { lossless: 1 }))
await save('photo.avif', await avifEncode.default(pixels(), { quality: 80 }))
await save('photo.jxl', await jxlEncode.default(pixels(), { quality: 90 }))
await save('photo.qoi', await qoiEncode.default(pixels()))
// A JPEG whose header is valid but whose image data is cut off.
await save('malformed.jpg', new Uint8Array(jpeg).slice(0, 180))
console.log('Fixtures written to', out)

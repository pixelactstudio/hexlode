import {
  ascii,
  asciiBytes,
  concatBytes,
  startsWithAscii,
  u32le,
  viewOf,
} from '#/features/images/metadata/bytes'
import type { ImageMetadata } from '#/features/images/metadata/types'

interface Chunk {
  type: string
  data: Uint8Array
}

function chunks(bytes: Uint8Array) {
  const view = viewOf(bytes)
  const found: Chunk[] = []
  let offset = 12
  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes, offset, 4)
    const length = view.getUint32(offset + 4, true)
    found.push({ type, data: bytes.subarray(offset + 8, offset + 8 + length) })
    offset += 8 + length + (length % 2)
  }
  return found
}

function chunk(type: string, data: Uint8Array) {
  const padding = data.length % 2 ? Uint8Array.of(0) : new Uint8Array(0)
  return concatBytes([asciiBytes(type), u32le(data.length), data, padding])
}

export function readWebpMetadata(bytes: Uint8Array): ImageMetadata {
  const metadata: ImageMetadata = {}
  for (const { type, data } of chunks(bytes)) {
    if (type === 'EXIF') {
      metadata.exif = startsWithAscii(data, 'Exif\0\0') ? data.slice(6) : data.slice()
    }
    if (type === 'XMP ') metadata.xmp = new TextDecoder().decode(data)
    if (type === 'ICCP') metadata.icc = data.slice()
  }
  return metadata
}

const ALPHA_FLAG = 0x10
const ANIMATION_FLAG = 0x02

function canvasOf(all: Chunk[], image: Chunk[]) {
  // Animated files keep their frames in ANMF chunks; the canvas is only in VP8X.
  const vp8x = all.find(({ type }) => type === 'VP8X')
  if (vp8x) {
    const data = vp8x.data
    return {
      width: (data[4] | (data[5] << 8) | (data[6] << 16)) + 1,
      height: (data[7] | (data[8] << 8) | (data[9] << 16)) + 1,
      alpha: (data[0] & ALPHA_FLAG) !== 0,
      animated: (data[0] & ANIMATION_FLAG) !== 0,
    }
  }
  const vp8l = image.find(({ type }) => type === 'VP8L')
  if (vp8l) {
    const bits = viewOf(vp8l.data).getUint32(1, true)
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
      alpha: ((bits >>> 28) & 1) === 1,
      animated: false,
    }
  }
  const vp8 = image.find(({ type }) => type === 'VP8 ')
  if (!vp8) throw new Error('The WebP file has no image data.')
  const view = viewOf(vp8.data)
  return {
    width: view.getUint16(6, true) & 0x3fff,
    height: view.getUint16(8, true) & 0x3fff,
    alpha: image.some(({ type }) => type === 'ALPH'),
    animated: false,
  }
}

export function writeWebpMetadata(bytes: Uint8Array, metadata: ImageMetadata) {
  const all = chunks(bytes)
  const image = all.filter(({ type }) => !['VP8X', 'ICCP', 'EXIF', 'XMP '].includes(type))
  const hasMetadata = Boolean(metadata.exif || metadata.xmp || metadata.icc)
  const canvas = canvasOf(all, image)
  const needsExtended = hasMetadata || canvas.animated || image.some(({ type }) => type === 'ALPH')
  const body: Uint8Array[] = []
  if (needsExtended) {
    const header = new Uint8Array(10)
    header[0] =
      (metadata.icc ? 0x20 : 0) |
      (canvas.alpha ? ALPHA_FLAG : 0) |
      (metadata.exif ? 0x08 : 0) |
      (metadata.xmp ? 0x04 : 0) |
      (canvas.animated ? ANIMATION_FLAG : 0)
    const view = viewOf(header)
    view.setUint16(4, (canvas.width - 1) & 0xffff, true)
    header[6] = (canvas.width - 1) >> 16
    view.setUint16(7, (canvas.height - 1) & 0xffff, true)
    header[9] = (canvas.height - 1) >> 16
    body.push(chunk('VP8X', header))
  }
  if (metadata.icc) body.push(chunk('ICCP', metadata.icc))
  for (const part of image) body.push(chunk(part.type, part.data))
  if (metadata.exif) body.push(chunk('EXIF', metadata.exif))
  if (metadata.xmp) body.push(chunk('XMP ', new TextEncoder().encode(metadata.xmp)))
  const content = concatBytes([asciiBytes('WEBP'), ...body])
  return {
    bytes: concatBytes([asciiBytes('RIFF'), u32le(content.length), content]),
    dropped: [],
  }
}

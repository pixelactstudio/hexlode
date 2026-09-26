import {
  MAX_DECODE_BYTES,
  MAX_IMAGE_DIMENSION,
  MAX_INPUT_BYTES,
  MAX_INPUT_MEGABYTES,
} from '#/features/image-input/constants'
import type {
  ImageInfo,
  ImageValidationErrorCode,
  SupportedImageFormat,
} from '#/features/image-input/types'

type Dimensions = Pick<ImageInfo, 'width' | 'height'>

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const PNG_HEADER_LENGTH = 33
const PNG_IHDR_DATA_LENGTH = 13
const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
])
const JXL_CONTAINER_SIGNATURE = [0, 0, 0, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a]
const AVIF_BRANDS = new Set(['avif', 'avis'])

export const IMAGE_MIME_TYPES: Record<SupportedImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  jxl: 'image/jxl',
  qoi: 'image/qoi',
}

export const IMAGE_EXTENSIONS: Record<SupportedImageFormat, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  avif: 'avif',
  jxl: 'jxl',
  qoi: 'qoi',
}

export class ImageValidationError extends Error {
  constructor(
    readonly code: ImageValidationErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ImageValidationError'
  }
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((value, index) => bytes[offset + index] === value)
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.subarray(start, start + length))
}

function malformed(format: string): never {
  throw new ImageValidationError('unsupported_format', `The ${format} header is malformed.`)
}

function readPng(bytes: Uint8Array): Dimensions | null {
  if (!startsWith(bytes, PNG_SIGNATURE)) return null
  if (bytes.length < PNG_HEADER_LENGTH) {
    throw new ImageValidationError('unsupported_format', 'The PNG header is truncated.')
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (ascii(bytes, 12, 4) !== 'IHDR' || view.getUint32(8) !== PNG_IHDR_DATA_LENGTH) {
    malformed('PNG')
  }
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

function readJpeg(bytes: Uint8Array): Dimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    return null
  }
  let offset = 2
  while (offset < bytes.length) {
    while (bytes[offset] === 0xff) offset += 1
    const marker = bytes[offset]
    offset += 1
    if (marker === undefined || marker === 0xd9 || marker === 0xda) break
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (offset + 2 > bytes.length) break
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1]
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break
    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      if (segmentLength < 7) break
      return {
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
      }
    }
    offset += segmentLength
  }
  malformed('JPEG')
}

function readWebp(bytes: Uint8Array): Dimensions | null {
  if (ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return null
  if (bytes.length < 30) malformed('WebP')
  const chunk = ascii(bytes, 12, 4)
  const u24 = (at: number) => bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16)
  if (chunk === 'VP8X') return { width: u24(24) + 1, height: u24(27) + 1 }
  if (chunk === 'VP8L') {
    if (bytes[20] !== 0x2f) malformed('WebP')
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24)
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
  }
  if (chunk === 'VP8 ') {
    if (!startsWith(bytes, [0x9d, 0x01, 0x2a], 23)) malformed('WebP')
    return {
      width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
      height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
    }
  }
  malformed('WebP')
}

function readAvif(bytes: Uint8Array): Dimensions | null {
  if (ascii(bytes, 4, 4) !== 'ftyp') return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const ftypSize = view.getUint32(0)
  const brands = [ascii(bytes, 8, 4)]
  for (let at = 16; at + 4 <= Math.min(ftypSize, bytes.length); at += 4) {
    brands.push(ascii(bytes, at, 4))
  }
  if (!brands.some((brand) => AVIF_BRANDS.has(brand))) return null
  // The first `ispe` property holds the primary image size.
  for (let at = ftypSize; at + 20 <= bytes.length; at += 1) {
    if (bytes[at] === 0x69 && ascii(bytes, at, 4) === 'ispe') {
      return { width: view.getUint32(at + 8), height: view.getUint32(at + 12) }
    }
  }
  malformed('AVIF')
}

class BitReader {
  private position = 0
  constructor(private readonly bytes: Uint8Array) {}
  read(count: number) {
    let value = 0
    for (let index = 0; index < count; index += 1) {
      const byte = this.bytes[this.position >> 3]
      if (byte === undefined) malformed('JPEG XL')
      value |= ((byte >> (this.position & 7)) & 1) << index
      this.position += 1
    }
    return value >>> 0
  }
}

const JXL_RATIOS: [number, number][] = [
  [1, 1],
  [12, 10],
  [4, 3],
  [3, 2],
  [16, 9],
  [5, 4],
  [2, 1],
]

function readJxlSize(codestream: Uint8Array): Dimensions {
  const reader = new BitReader(codestream.subarray(2))
  const dimension = () => {
    const bits = [9, 13, 18, 30][reader.read(2)]
    return reader.read(bits) + 1
  }
  const small = reader.read(1) === 1
  const height = small ? (reader.read(5) + 1) * 8 : dimension()
  const ratio = reader.read(3)
  if (ratio > 0) {
    const [numerator, denominator] = JXL_RATIOS[ratio - 1]
    return { width: Math.floor((height * numerator) / denominator), height }
  }
  return { width: small ? (reader.read(5) + 1) * 8 : dimension(), height }
}

function readJxl(bytes: Uint8Array): Dimensions | null {
  if (bytes[0] === 0xff && bytes[1] === 0x0a) return readJxlSize(bytes)
  if (!startsWith(bytes, JXL_CONTAINER_SIGNATURE)) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let at = 0
  while (at + 8 <= bytes.length) {
    const size = view.getUint32(at)
    const type = ascii(bytes, at + 4, 4)
    if (type === 'jxlc') return readJxlSize(bytes.subarray(at + 8))
    if (type === 'jxlp') return readJxlSize(bytes.subarray(at + 12))
    if (size < 8) break
    at += size
  }
  malformed('JPEG XL')
}

function readQoi(bytes: Uint8Array): Dimensions | null {
  if (ascii(bytes, 0, 4) !== 'qoif') return null
  if (bytes.length < 14) malformed('QOI')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(4), height: view.getUint32(8) }
}

const READERS: [SupportedImageFormat, (bytes: Uint8Array) => Dimensions | null][] = [
  ['png', readPng],
  ['jpeg', readJpeg],
  ['webp', readWebp],
  ['avif', readAvif],
  ['jxl', readJxl],
  ['qoi', readQoi],
]

function estimateDecodeBytes(width: number, height: number) {
  const estimatedDecodeBytes = width * height * 4
  const dimensionsAreUnsafe =
    width < 1 ||
    height < 1 ||
    width > MAX_IMAGE_DIMENSION ||
    height > MAX_IMAGE_DIMENSION ||
    !Number.isSafeInteger(estimatedDecodeBytes) ||
    estimatedDecodeBytes > MAX_DECODE_BYTES
  if (dimensionsAreUnsafe) {
    throw new ImageValidationError(
      'invalid_dimensions',
      'The image dimensions are too large to process safely on this device.',
    )
  }
  return estimatedDecodeBytes
}

function normalizeDeclaredType(type: string) {
  return type === 'image/jpg' ? 'image/jpeg' : type
}

/**
 * Finds the format and dimensions from the first bytes of a file and refuses files that are not a
 * supported image or are too large to decode safely.
 */
export function inspectImageHeader(buffer: ArrayBuffer, declaredType = '', fileSize?: number) {
  if ((fileSize ?? buffer.byteLength) > MAX_INPUT_BYTES) {
    throw new ImageValidationError(
      'file_too_large',
      `Choose an image smaller than ${MAX_INPUT_MEGABYTES} MB.`,
    )
  }
  const bytes = new Uint8Array(buffer)
  for (const [format, read] of READERS) {
    const dimensions = read(bytes)
    if (!dimensions) continue
    const mimeType = IMAGE_MIME_TYPES[format]
    const declared = normalizeDeclaredType(declaredType)
    const knownDeclared = Object.values(IMAGE_MIME_TYPES).includes(declared)
    if (knownDeclared && declared !== mimeType) {
      throw new ImageValidationError(
        'mime_mismatch',
        `The file contents are ${format.toUpperCase()}, but the file reports a different type.`,
      )
    }
    return {
      format,
      mimeType,
      ...dimensions,
      estimatedDecodeBytes: estimateDecodeBytes(dimensions.width, dimensions.height),
    } satisfies ImageInfo
  }
  throw new ImageValidationError(
    'unsupported_format',
    'Choose a JPEG, PNG, WebP, AVIF, JPEG XL or QOI image.',
  )
}

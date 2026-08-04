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

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const PNG_HEADER_LENGTH = 33
const PNG_IHDR_DATA_LENGTH = 13
const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
])

export class ImageValidationError extends Error {
  constructor(
    readonly code: ImageValidationErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ImageValidationError'
  }
}

function hasPngSignature(bytes: Uint8Array) {
  return PNG_SIGNATURE.every((value, index) => bytes[index] === value)
}

function readPngDimensions(bytes: Uint8Array): Pick<ImageInfo, 'width' | 'height'> | null {
  if (!hasPngSignature(bytes)) return null
  if (bytes.length < PNG_HEADER_LENGTH) {
    throw new ImageValidationError('unsupported_format', 'The PNG header is truncated.')
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const chunkLength = view.getUint32(8)
  const chunkType = String.fromCharCode(...bytes.subarray(12, 16))
  if (chunkType !== 'IHDR' || chunkLength !== PNG_IHDR_DATA_LENGTH) {
    throw new ImageValidationError('unsupported_format', 'The PNG header is malformed.')
  }

  return { width: view.getUint32(16), height: view.getUint32(20) }
}

function readJpegDimensions(bytes: Uint8Array): Pick<ImageInfo, 'width' | 'height'> | null {
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
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4]
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6]
      return { width, height }
    }

    offset += segmentLength
  }

  throw new ImageValidationError('unsupported_format', 'The JPEG header is malformed.')
}

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

function imageType(format: SupportedImageFormat) {
  return format === 'png' ? ('image/png' as const) : ('image/jpeg' as const)
}

export function inspectImageHeader(buffer: ArrayBuffer, declaredType = ''): ImageInfo {
  if (buffer.byteLength > MAX_INPUT_BYTES) {
    throw new ImageValidationError(
      'file_too_large',
      `Choose an image smaller than ${MAX_INPUT_MEGABYTES} MB.`,
    )
  }

  const bytes = new Uint8Array(buffer)
  const pngDimensions = readPngDimensions(bytes)
  const jpegDimensions = pngDimensions ? null : readJpegDimensions(bytes)
  const dimensions = pngDimensions ?? jpegDimensions

  if (!dimensions) {
    throw new ImageValidationError('unsupported_format', 'Choose a valid JPEG or PNG image.')
  }

  const format: SupportedImageFormat = pngDimensions ? 'png' : 'jpeg'
  const mimeType = imageType(format)
  const normalizedType = normalizeDeclaredType(declaredType)
  if (normalizedType && normalizedType !== mimeType) {
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
  }
}

export const MAX_INPUT_BYTES = 30 * 1024 * 1024
export const MAX_DECODE_BYTES = 256 * 1024 * 1024
export const MAX_IMAGE_DIMENSION = 16_384

export type SupportedImageFormat = 'jpeg' | 'png'

export interface ImageInfo {
  format: SupportedImageFormat
  mimeType: 'image/jpeg' | 'image/png'
  width: number
  height: number
  estimatedDecodeBytes: number
}

export type ImageValidationErrorCode =
  | 'file_too_large'
  | 'invalid_dimensions'
  | 'mime_mismatch'
  | 'unsupported_format'

export class ImageValidationError extends Error {
  constructor(
    readonly code: ImageValidationErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ImageValidationError'
  }
}

const jpegStartOfFrameMarkers = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
])

function readPngDimensions(bytes: Uint8Array): Pick<ImageInfo, 'width' | 'height'> | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length < 24 || !signature.every((value, index) => bytes[index] === value)) {
    return null
  }

  const isHeader = String.fromCharCode(...bytes.subarray(12, 16)) === 'IHDR'
  if (!isHeader) {
    throw new ImageValidationError('unsupported_format', 'The PNG header is malformed.')
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
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

    if (jpegStartOfFrameMarkers.has(marker)) {
      if (segmentLength < 7) break
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4]
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6]
      return { width, height }
    }

    offset += segmentLength
  }

  throw new ImageValidationError('unsupported_format', 'The JPEG header is malformed.')
}

function validateDimensions(width: number, height: number) {
  const estimatedDecodeBytes = width * height * 4
  if (
    width < 1 ||
    height < 1 ||
    width > MAX_IMAGE_DIMENSION ||
    height > MAX_IMAGE_DIMENSION ||
    !Number.isSafeInteger(estimatedDecodeBytes) ||
    estimatedDecodeBytes > MAX_DECODE_BYTES
  ) {
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

export function inspectImageHeader(buffer: ArrayBuffer, declaredType = ''): ImageInfo {
  if (buffer.byteLength > MAX_INPUT_BYTES) {
    throw new ImageValidationError(
      'file_too_large',
      `Choose an image smaller than ${MAX_INPUT_BYTES / 1024 / 1024} MB.`,
    )
  }

  const bytes = new Uint8Array(buffer)
  const png = readPngDimensions(bytes)
  const jpeg = png ? null : readJpegDimensions(bytes)
  const dimensions = png ?? jpeg

  if (!dimensions) {
    throw new ImageValidationError('unsupported_format', 'Choose a valid JPEG or PNG image.')
  }

  const format = png ? 'png' : 'jpeg'
  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'
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
    estimatedDecodeBytes: validateDimensions(dimensions.width, dimensions.height),
  }
}

import type { ImageFormat } from '#/features/engine/types'

export type SupportedImageFormat = ImageFormat

export interface ImageInfo {
  format: SupportedImageFormat
  mimeType: string
  width: number
  height: number
  estimatedDecodeBytes: number
}

export type ImageValidationErrorCode =
  | 'file_too_large'
  | 'invalid_dimensions'
  | 'mime_mismatch'
  | 'unsupported_format'

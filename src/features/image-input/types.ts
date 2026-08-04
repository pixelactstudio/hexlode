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

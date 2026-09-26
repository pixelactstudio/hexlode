import type { ImageFormat, Item } from '#/features/engine/types'
import type { ImageMetadata } from '#/features/images/metadata/types'

/** RGBA pixels, 8 bits per channel. Shaped like ImageData so codecs accept it directly. */
export interface Pixels {
  data: Uint8ClampedArray
  width: number
  height: number
}

export type ResizeMethod = 'lanczos3' | 'mitchell' | 'catrom' | 'triangle'

export interface JpegOptions {
  quality: number
  progressive: boolean
  chromaSubsampling: '420' | '444'
}

export interface WebpOptions {
  quality: number
  lossless: boolean
  /** 0 (fast) to 6 (small). */
  effort: number
  nearLossless: number
  sharpYuv: boolean
}

export interface AvifOptions {
  quality: number
  lossless: boolean
  /** 0 (fast) to 10 (small). */
  effort: number
  chromaSubsampling: '420' | '444'
  sharpYuv: boolean
}

export interface JxlOptions {
  quality: number
  lossless: boolean
  /** 1 (fast) to 9 (small). */
  effort: number
  progressive: boolean
}

export interface PngOptions {
  /** Oxipng level, 0 (fast) to 6 (small). */
  optimisationLevel: number
  interlace: boolean
}

export type EncodeOptions =
  | { format: 'jpeg'; options: JpegOptions }
  | { format: 'webp'; options: WebpOptions }
  | { format: 'avif'; options: AvifOptions }
  | { format: 'jxl'; options: JxlOptions }
  | { format: 'png'; options: PngOptions }
  | { format: 'qoi'; options: Record<string, never> }

export interface Codecs {
  decode(format: ImageFormat, bytes: Uint8Array): Promise<Pixels>
  encode(settings: EncodeOptions, pixels: Pixels): Promise<Uint8Array>
  resize(pixels: Pixels, width: number, height: number, method: ResizeMethod): Promise<Pixels>
  optimisePng(bytes: Uint8Array, options: PngOptions): Promise<Uint8Array>
}

export interface ImagePayload {
  /** The file bytes in `meta.format`, while they still match the pixels. */
  encoded?: Uint8Array
  /** Decoded pixels. Filled on first use and dropped before storing when `encoded` exists. */
  pixels?: Pixels
  metadata: ImageMetadata
  /** True when `metadata` differs from what `encoded` contains. */
  metadataChanged: boolean
  /** Settings of the last encoder, reused when the item must be encoded again. */
  encode?: EncodeOptions
}

export type ImageItem = Item<ImagePayload>

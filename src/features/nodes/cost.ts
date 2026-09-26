import type { ImageFormat, ItemMeta, NodeCost } from '#/features/engine/types'

/**
 * Milliseconds per megapixel on one core of a typical laptop. Rough numbers for estimates; the
 * Studio scales them by what it measured on this device in earlier runs.
 */
export const DECODE_MS_PER_MEGAPIXEL: Record<ImageFormat, number> = {
  jpeg: 12,
  png: 20,
  webp: 20,
  avif: 60,
  jxl: 50,
  qoi: 6,
}

export const ENCODE_MS_PER_MEGAPIXEL: Record<ImageFormat, number> = {
  jpeg: 45,
  png: 180,
  webp: 120,
  avif: 700,
  jxl: 400,
  qoi: 8,
}

export const RESIZE_MS_PER_MEGAPIXEL = 25
export const PIXEL_OP_MS_PER_MEGAPIXEL = 6

export function megapixels(meta: ItemMeta) {
  return ((meta.width ?? 0) * (meta.height ?? 0)) / 1_000_000
}

/** Typical encoded bytes per pixel, to predict sizes in estimates. */
export const BYTES_PER_PIXEL: Record<ImageFormat, number> = {
  jpeg: 0.3,
  png: 2,
  webp: 0.2,
  avif: 0.12,
  jxl: 0.18,
  qoi: 2.5,
}

export function encodeCost(meta: ItemMeta, format: ImageFormat): NodeCost {
  return { ms: ENCODE_MS_PER_MEGAPIXEL[format] * megapixels(meta), encodes: 1, needsPixels: true }
}

export function pixelCost(meta: ItemMeta, msPerMegapixel: number): NodeCost {
  return { ms: msPerMegapixel * megapixels(meta), encodes: 0, needsPixels: true }
}

export function predictedSize(meta: ItemMeta, format: ImageFormat) {
  return Math.round((meta.width ?? 0) * (meta.height ?? 0) * BYTES_PER_PIXEL[format])
}

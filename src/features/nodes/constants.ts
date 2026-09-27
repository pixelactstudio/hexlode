import { ALL_IMAGE_TYPES, typesOf } from '#/features/engine/item-types'
import type { ItemType } from '#/features/engine/types'

export { ALL_IMAGE_TYPES }

/** Formats whose encoders take a quality setting. */
export const LOSSY_FORMATS = ['jpeg', 'webp', 'avif', 'jxl'] as const
export const LOSSY_IMAGE_TYPES = typesOf('image', LOSSY_FORMATS)
export const PNG_TYPES = new Set<ItemType>(['image:png'])

export const OUTPUT_PORT = [{ id: 'out', label: 'Output' }]

export const DEFAULT_LONGEST_EDGE = 1920
export const MAX_RESIZE_DIMENSION = 16_383
export const DEFAULT_TARGET_KILOBYTES = 200
export const COMPRESS_SEARCH_STEPS = 7
export const COMPRESS_MIN_QUALITY = 1
export const COMPRESS_MAX_QUALITY = 95

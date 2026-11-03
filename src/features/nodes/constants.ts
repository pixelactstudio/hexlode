import { ALL_IMAGE_TYPES, ALL_ITEM_TYPES, typesOf } from '#/features/engine/item-types'
import type { ItemType } from '#/features/engine/types'

export { ALL_IMAGE_TYPES, ALL_ITEM_TYPES }

/** Formats whose encoders take a quality setting. */
export const LOSSY_FORMATS = ['jpeg', 'webp', 'avif', 'jxl'] as const
export const LOSSY_IMAGE_TYPES = typesOf('image', LOSSY_FORMATS)
export const PNG_TYPES = new Set<ItemType>(['image:png'])
export const JSON_TYPES = new Set<ItemType>(['data:json'])
export const TEXT_TYPES = new Set<ItemType>(['data:text'])

export const OUTPUT_PORT = [{ id: 'out', label: 'Output' }]

export const DEFAULT_LONGEST_EDGE = 1920
export const MAX_RESIZE_DIMENSION = 16_383
export const DEFAULT_TARGET_KILOBYTES = 200
export const COMPRESS_SEARCH_STEPS = 7
export const COMPRESS_MIN_QUALITY = 1
export const COMPRESS_MAX_QUALITY = 95

/** Logos are kept in the pipeline itself, so they must stay small. */
export const MAX_LOGO_BYTES = 512 * 1024
/** SVG logos are drawn at this longest edge when chosen. */
export const SVG_LOGO_EDGE = 1024

/** Contact sheets stay within these limits, and start a new sheet when one is full. */
export const MAX_SHEET_EDGE = 16_000
export const MAX_SHEET_PIXELS = 50_000_000

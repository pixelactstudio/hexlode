import { z } from 'zod'
import { intersect, itemType, union } from '#/features/engine/item-types'
import type { EncodableFormat, ImageFormat, ItemType } from '#/features/engine/types'
import {
  asImage,
  codecsOf,
  DEFAULT_ENCODE,
  encodeImage,
  keptFormatWarning,
  pixelsOf,
  replaceExtension,
} from '#/features/images/image-item'
import type { EncodeOptions, ImageItem } from '#/features/images/types'
import {
  ALL_IMAGE_TYPES,
  COMPRESS_MAX_QUALITY,
  COMPRESS_MIN_QUALITY,
  COMPRESS_SEARCH_STEPS,
  DEFAULT_TARGET_KILOBYTES,
  LOSSY_IMAGE_TYPES,
  OUTPUT_PORT,
} from '#/features/nodes/constants'
import { encodeCost, predictedSize } from '#/features/nodes/cost'
import { defineNode } from '#/features/nodes/define-node'

const schema = z.object({
  targetKilobytes: z.number().min(1).max(1_000_000).default(DEFAULT_TARGET_KILOBYTES),
  format: z.enum(['original', 'jpeg', 'webp', 'avif', 'jxl']).default('original'),
})

function withQuality(format: EncodableFormat, quality: number): EncodeOptions {
  const base = DEFAULT_ENCODE[format]
  return { ...base, options: { ...base.options, quality } } as EncodeOptions
}

const HEIC = new Set<ItemType>(['image:heic'])
/** With Original, the lossy formats keep theirs. HEIC is lossy too, and becomes JPEG. */
const ORIGINAL_ACCEPTS = union([LOSSY_IMAGE_TYPES, HEIC])

/** The lossy format an image is compressed in when it keeps its own. */
function sizedFormat(format: ImageFormat) {
  return format === 'heic' ? 'jpeg' : (format as EncodableFormat)
}

export const compressToSizeNode = defineNode({
  type: 'compress-to-size',
  label: 'Compress to size',
  category: 'output',
  description: 'Finds the highest quality that fits a target size such as 200 KB.',
  schema,
  ports: () => OUTPUT_PORT,
  accepts: (settings) => (settings.format === 'original' ? ORIGINAL_ACCEPTS : ALL_IMAGE_TYPES),
  produces: (settings, input) => {
    if (settings.format !== 'original') return new Set([itemType('image', settings.format)])
    const lossy = intersect(input, LOSSY_IMAGE_TYPES)
    return input.has('image:heic') ? union([lossy, new Set(['image:jpeg' as const])]) : lossy
  },
  simulate: (settings, meta) => {
    const format =
      settings.format === 'original' ? sizedFormat(meta.format as ImageFormat) : settings.format
    return [
      {
        port: 'out',
        meta: {
          ...meta,
          format,
          name: replaceExtension(meta.name, format),
          size: predictedSize(meta, format),
        },
      },
    ]
  },
  cost: (settings, meta) => {
    const single = encodeCost(
      meta,
      settings.format === 'original' ? sizedFormat(meta.format as ImageFormat) : settings.format,
    )
    return {
      ...single,
      ms: single.ms * (COMPRESS_SEARCH_STEPS + 1),
      encodes: COMPRESS_SEARCH_STEPS + 1,
    }
  },
  async run(input, settings, context) {
    if (input.mode !== 'each') throw new Error('Compress to size runs per item.')
    const item = asImage(input.item)
    const codecs = codecsOf(context)
    const own = item.meta.format as ImageFormat
    const format = settings.format === 'original' ? sizedFormat(own) : settings.format
    if (settings.format === 'original' && format !== own) context.warn(keptFormatWarning(format))
    const target = settings.targetKilobytes * 1024
    await pixelsOf(item, codecs)

    let low = COMPRESS_MIN_QUALITY
    let high = COMPRESS_MAX_QUALITY
    let best: ImageItem | undefined
    let smallest: ImageItem | undefined
    for (let step = 0; step < COMPRESS_SEARCH_STEPS && low <= high; step += 1) {
      const quality = Math.round((low + high) / 2)
      const attempt = await encodeImage(item, withQuality(format, quality), codecs)
      const size = attempt.meta.size ?? Number.POSITIVE_INFINITY
      if (!smallest || size < (smallest.meta.size ?? Number.POSITIVE_INFINITY)) smallest = attempt
      if (size <= target) {
        best = attempt
        low = quality + 1
      } else {
        high = quality - 1
      }
    }
    if (!best) {
      const floor = await encodeImage(item, withQuality(format, COMPRESS_MIN_QUALITY), codecs)
      best =
        (floor.meta.size ?? 0) < (smallest?.meta.size ?? Number.POSITIVE_INFINITY)
          ? floor
          : smallest
      if ((best?.meta.size ?? 0) > target) {
        context.warn({
          code: 'target_not_reached',
          message: `${item.meta.name} could not be made smaller than ${Math.ceil((best?.meta.size ?? 0) / 1024)} KB.`,
        })
      }
    }
    // Re-encode once with metadata warnings reported, at the chosen quality.
    const chosen = best?.payload.encode as EncodeOptions
    const final = await encodeImage(item, chosen, codecs, context.warn)
    return [{ port: 'out', item: final }]
  },
})

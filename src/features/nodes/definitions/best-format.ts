import { z } from 'zod'

import { typesOf, union } from '#/features/engine/item-types'
import type { ImageFormat, NodeWarning } from '#/features/engine/types'
import {
  asImage,
  codecsOf,
  encodeImage,
  encodeWithQuality,
  FORMAT_NAMES,
  replaceExtension,
} from '#/features/images/image-item'
import type { ImageItem } from '#/features/images/types'
import { ALL_IMAGE_TYPES, OUTPUT_PORT } from '#/features/nodes/constants'
import { encodeCost, predictedSize } from '#/features/nodes/cost'
import { defineNode } from '#/features/nodes/define-node'

export const CANDIDATE_FORMATS = ['webp', 'avif', 'jpeg', 'jxl', 'png'] as const

const schema = z.object({
  formats: z.array(z.enum(CANDIDATE_FORMATS)).min(1).max(5).default(['webp', 'avif']),
  /** Quality for the lossy formats. PNG is always lossless. */
  quality: z.number().int().min(1).max(100).default(75),
  /** Also consider the file as it arrived, and keep it when nothing beats it. */
  keepOriginal: z.boolean().default(false),
})

type BestFormatSettings = z.infer<typeof schema>

function uniqueFormats(settings: BestFormatSettings) {
  return [...new Set(settings.formats)]
}

export const bestFormatNode = defineNode({
  type: 'best-format',
  label: 'Best format',
  category: 'output',
  description: 'Encodes several formats and keeps the smallest.',
  schema,
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: (settings, input) => {
    const encoded = typesOf('image', uniqueFormats(settings))
    return settings.keepOriginal ? union([encoded, input]) : encoded
  },
  simulate: (settings, meta) => {
    const sizes = uniqueFormats(settings).map((format) => ({
      format,
      size: predictedSize(meta, format),
    }))
    const smallest = sizes.reduce((best, entry) => (entry.size < best.size ? entry : best))
    if (settings.keepOriginal && meta.size !== undefined && meta.size <= smallest.size) {
      return [{ port: 'out', meta }]
    }
    return [
      {
        port: 'out',
        meta: {
          ...meta,
          format: smallest.format,
          name: replaceExtension(meta.name, smallest.format),
          size: smallest.size,
        },
      },
    ]
  },
  cost: (settings, meta) => {
    const costs = uniqueFormats(settings).map((format) => encodeCost(meta, format))
    return {
      ms: costs.reduce((total, cost) => total + cost.ms, 0),
      encodes: costs.length,
      needsPixels: true,
    }
  },
  async run(input, settings, context) {
    if (input.mode !== 'each') throw new Error('Best format runs per item.')
    const item = asImage(input.item)
    const codecs = codecsOf(context)
    const sizes: Record<string, number> = {}
    let best: { item: ImageItem; warnings: NodeWarning[] } | undefined
    const original =
      settings.keepOriginal && item.payload.encoded && !item.payload.metadataChanged
        ? item.payload.encoded.byteLength
        : undefined
    if (original !== undefined) sizes.original = original
    for (const format of uniqueFormats(settings)) {
      const warnings: NodeWarning[] = []
      const encoded = await encodeImage(
        item,
        encodeWithQuality(format, settings.quality),
        codecs,
        (warning) => warnings.push(warning),
      )
      const size = encoded.meta.size ?? Number.POSITIVE_INFINITY
      sizes[format] = size
      if (!best || size < (best.item.meta.size ?? Number.POSITIVE_INFINITY)) {
        best = { item: encoded, warnings }
      }
    }
    const keepsOriginal =
      original !== undefined && (!best || original <= (best.item.meta.size ?? 0))
    const chosen = keepsOriginal || !best ? item : best.item
    if (!keepsOriginal) for (const warning of best?.warnings ?? []) context.warn(warning)
    context.record({
      name: item.meta.name,
      fields: { format: FORMAT_NAMES[chosen.meta.format as ImageFormat], ...sizes },
    })
    return [{ port: 'out', item: chosen }]
  },
})

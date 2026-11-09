import { z } from 'zod'

import { itemType, union } from '#/features/engine/item-types'
import type { EncodableFormat, ImageFormat } from '#/features/engine/types'
import {
  asImage,
  codecsOf,
  encodeImage,
  keptFormat,
  keptFormatWarning,
  keptTypes,
  pixelsOf,
  replaceExtension,
} from '#/features/images/image-item'
import type { EncodeOptions } from '#/features/images/types'
import { ALL_IMAGE_TYPES, OUTPUT_PORT } from '#/features/nodes/constants'
import { encodeCost, predictedSize } from '#/features/nodes/cost'
import { defineNode } from '#/features/nodes/define-node'

const quality = (value: number) => z.number().int().min(1).max(100).default(value)
const subsampling = z.enum(['420', '444']).default('420')

export const encoderSchemas = {
  jpeg: z
    .object({
      quality: quality(82),
      progressive: z.boolean().default(true),
      chromaSubsampling: subsampling,
    })
    .prefault({}),
  webp: z
    .object({
      quality: quality(82),
      lossless: z.boolean().default(false),
      effort: z.number().int().min(0).max(6).default(4),
      nearLossless: z.number().int().min(0).max(100).default(100),
      sharpYuv: z.boolean().default(false),
    })
    .prefault({}),
  avif: z
    .object({
      quality: quality(60),
      lossless: z.boolean().default(false),
      effort: z.number().int().min(0).max(10).default(4),
      chromaSubsampling: subsampling,
      sharpYuv: z.boolean().default(false),
    })
    .prefault({}),
  jxl: z
    .object({
      quality: quality(80),
      lossless: z.boolean().default(false),
      effort: z.number().int().min(1).max(9).default(7),
      progressive: z.boolean().default(false),
    })
    .prefault({}),
  png: z
    .object({
      optimisationLevel: z.number().int().min(0).max(6).default(2),
      interlace: z.boolean().default(false),
    })
    .prefault({}),
}

const schema = z.object({
  format: z.enum(['original', 'jpeg', 'png', 'webp', 'avif', 'jxl', 'qoi']).default('webp'),
  /** With Original: pass the item on unchanged when encoding would not make it smaller. */
  keepSmaller: z.boolean().default(false),
  ...encoderSchemas,
})

export type ConvertSettings = z.infer<typeof schema>

export function encodeOptionsFor(
  settings: ConvertSettings,
  format: EncodableFormat,
): EncodeOptions {
  if (format === 'qoi') return { format, options: {} }
  return { format, options: settings[format] } as EncodeOptions
}

export const convertNode = defineNode({
  type: 'convert',
  label: 'Convert',
  category: 'output',
  description: 'Encodes to WebP, AVIF, JPEG, JPEG XL, PNG or QOI with the encoder’s real settings.',
  schema,
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: (settings, input) =>
    settings.format === 'original'
      ? settings.keepSmaller
        ? union([input, keptTypes(input)])
        : keptTypes(input)
      : new Set([itemType('image', settings.format)]),
  simulate: (settings, meta) => {
    const format =
      settings.format === 'original' ? keptFormat(meta.format as ImageFormat) : settings.format
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
  cost: (settings, meta) =>
    encodeCost(
      meta,
      settings.format === 'original' ? keptFormat(meta.format as ImageFormat) : settings.format,
    ),
  async run(input, settings, context) {
    if (input.mode !== 'each') throw new Error('Convert runs per item.')
    const item = asImage(input.item)
    const codecs = codecsOf(context)
    const own = item.meta.format as ImageFormat
    const format =
      settings.format === 'original'
        ? keptFormat(own, await pixelsOf(item, codecs))
        : settings.format
    const encoded = await encodeImage(
      item,
      encodeOptionsFor(settings, format),
      codecs,
      context.warn,
    )
    const original = item.payload.encoded
    const keepOriginal =
      settings.format === 'original' &&
      settings.keepSmaller &&
      original !== undefined &&
      !item.payload.metadataChanged &&
      (encoded.meta.size ?? 0) >= original.byteLength
    if (keepOriginal) return [{ port: 'out', item }]
    if (settings.format === 'original' && format !== own) context.warn(keptFormatWarning(format))
    return [{ port: 'out', item: encoded }]
  },
})

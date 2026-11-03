import { z } from 'zod'

import { itemType, union } from '#/features/engine/item-types'
import type { ImageFormat, ItemTypeSet } from '#/features/engine/types'
import { nameWithEnding, textItem } from '#/features/file-items/file-item'
import {
  asImage,
  codecsOf,
  encodeImage,
  encodeWithQuality,
  nameWithSuffix,
  uprightPixelsOf,
  withUprightPixels,
} from '#/features/images/image-item'
import { displaySize } from '#/features/images/pixel-ops'
import { ALL_IMAGE_TYPES, MAX_RESIZE_DIMENSION, TEXT_TYPES } from '#/features/nodes/constants'
import { encodeCost, RESIZE_MS_PER_MEGAPIXEL } from '#/features/nodes/cost'
import { defineNode } from '#/features/nodes/define-node'

const schema = z.object({
  widths: z
    .array(z.number().int().min(16).max(MAX_RESIZE_DIMENSION))
    .min(1)
    .max(12)
    .default([480, 960, 1440, 1920]),
  format: z.enum(['original', 'webp', 'avif', 'jpeg', 'png']).default('webp'),
  quality: z.number().int().min(1).max(100).default(80),
  /** The `sizes` attribute: how wide the image shows at each screen width. */
  sizes: z.string().max(300).default('100vw'),
  /** Put before each file name in the snippet, such as `/images/`. */
  path: z.string().max(300).default(''),
})

type ResponsiveSettings = z.infer<typeof schema>

/** Requested widths up to the image's own; when any were larger, the image's own width too. */
function planWidths(settings: ResponsiveSettings, width: number) {
  const fitting = [...new Set(settings.widths)].filter((value) => value < width)
  const larger = settings.widths.some((value) => value >= width)
  return (larger || fitting.length === 0 ? [...fitting, width] : fitting).sort((a, b) => a - b)
}

const escapeAttribute = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

const leaf = (name: string) => name.slice(name.lastIndexOf('/') + 1)

function snippet(
  files: { name: string; width: number; height: number }[],
  settings: ResponsiveSettings,
) {
  const url = (name: string) => escapeAttribute(`${settings.path}${leaf(name)}`)
  const largest = files[files.length - 1]
  return [
    '<img',
    `  src="${url(largest.name)}"`,
    `  srcset="${files.map((file) => `${url(file.name)} ${file.width}w`).join(', ')}"`,
    `  sizes="${escapeAttribute(settings.sizes)}"`,
    `  width="${largest.width}"`,
    `  height="${largest.height}"`,
    '  alt=""',
    '  loading="lazy"',
    '  decoding="async"',
    '>',
    '',
  ].join('\n')
}

export const responsiveSetNode = defineNode({
  type: 'responsive-set',
  label: 'Responsive set',
  category: 'output',
  description: 'Makes several widths and a ready srcset HTML snippet.',
  privateSettings: ['sizes', 'path'],
  schema,
  ports: () => [{ id: 'out', label: 'Images and HTML' }],
  accepts: () => ALL_IMAGE_TYPES,
  produces: (settings, input): ItemTypeSet =>
    union([
      settings.format === 'original' ? input : new Set([itemType('image', settings.format)]),
      TEXT_TYPES,
    ]),
  cost: (settings, meta) => {
    const format = settings.format === 'original' ? (meta.format as ImageFormat) : settings.format
    const count = planWidths(settings, displaySize(meta).width).length
    const encode = encodeCost(meta, format)
    return {
      ms:
        (encode.ms + (RESIZE_MS_PER_MEGAPIXEL * ((meta.width ?? 0) * (meta.height ?? 0))) / 1e6) *
        count,
      encodes: count,
      needsPixels: true,
    }
  },
  async run(input, settings, context) {
    if (input.mode !== 'each') throw new Error('Responsive set runs per item.')
    const item = asImage(input.item)
    const codecs = codecsOf(context)
    const format =
      settings.format === 'original' ? (item.meta.format as ImageFormat) : settings.format
    const pixels = await uprightPixelsOf(item, codecs)
    const outputs = []
    for (const width of planWidths(settings, pixels.width)) {
      const height = Math.max(1, Math.round((pixels.height * width) / pixels.width))
      const resized =
        width === pixels.width ? pixels : await codecs.resize(pixels, width, height, 'lanczos3')
      const sized = withUprightPixels(item, resized)
      sized.meta = { ...sized.meta, name: nameWithSuffix(item.meta.name, `-${width}w`) }
      outputs.push(
        await encodeImage(sized, encodeWithQuality(format, settings.quality), codecs, context.warn),
      )
    }
    const files = outputs.map((output) => ({
      name: output.meta.name,
      width: output.meta.width ?? 0,
      height: output.meta.height ?? 0,
    }))
    const html = textItem(
      'text',
      nameWithEnding(item.meta.name, '.html'),
      snippet(files, settings),
      item.meta.source,
    )
    return [
      ...outputs.map((output) => ({ port: 'out', item: output })),
      { port: 'out', item: html },
    ]
  },
})

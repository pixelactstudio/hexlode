import { z } from 'zod'

import { jsonItem, nameWithEnding } from '#/features/file-items/file-item'
import { encodeBlurhash } from '#/features/images/blurhash'
import { hexOf } from '#/features/images/colour'
import { flatten } from '#/features/images/compose'
import { asImage, codecsOf, uprightPixelsOf } from '#/features/images/image-item'
import { displaySize } from '#/features/images/pixel-ops'
import { scaleDown } from '#/features/images/thumbnail'
import type { EncodeOptions, Pixels } from '#/features/images/types'
import { ALL_IMAGE_TYPES, JSON_TYPES, OUTPUT_PORT } from '#/features/nodes/constants'
import { PIXEL_OP_MS_PER_MEGAPIXEL, pixelCost } from '#/features/nodes/cost'
import { defineNode } from '#/features/nodes/define-node'
import { bytesToBase64 } from '#/lib/base64'

const component = z.number().int().min(1).max(9)

const schema = z.object({
  /** A tiny WebP as a data URI works in plain HTML; a BlurHash needs a small decoder. */
  method: z.enum(['data-uri', 'blurhash']).default('data-uri'),
  /** Longest edge of the data URI image, in pixels. */
  size: z.number().int().min(4).max(64).default(16),
  componentsX: component.default(4),
  componentsY: component.default(3),
})

/** BlurHash keeps only coarse shapes, so it is computed from a copy this small. */
const BLURHASH_EDGE = 64
const DATA_URI_ENCODE: EncodeOptions = {
  format: 'webp',
  options: { quality: 50, lossless: false, effort: 4, nearLossless: 100, sharpYuv: false },
}

/** The average colour of the visible pixels, weighted by how opaque they are. */
function averageColour(pixels: Pixels) {
  const { data } = pixels
  const step = Math.max(1, Math.floor(data.length / 4 / 65_536)) * 4
  const sum = [0, 0, 0]
  let weight = 0
  for (let at = 0; at < data.length; at += step) {
    const alpha = data[at + 3]
    sum[0] += data[at] * alpha
    sum[1] += data[at + 1] * alpha
    sum[2] += data[at + 2] * alpha
    weight += alpha
  }
  return weight === 0 ? '#000000' : hexOf(sum[0] / weight, sum[1] / weight, sum[2] / weight)
}

export const placeholderNode = defineNode({
  type: 'placeholder',
  label: 'Placeholder',
  category: 'output',
  description: 'Generates a tiny blurred preview code for websites.',
  schema,
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: () => JSON_TYPES,
  cost: (_settings, meta) => pixelCost(meta, PIXEL_OP_MS_PER_MEGAPIXEL),
  async run(input, settings, context) {
    if (input.mode !== 'each') throw new Error('Placeholder runs per item.')
    const item = asImage(input.item)
    const codecs = codecsOf(context)
    const pixels = await uprightPixelsOf(item, codecs)
    const { width, height } = displaySize(item.meta)
    const value: Record<string, unknown> = {
      image: item.meta.name,
      width,
      height,
      colour: averageColour(pixels),
    }
    if (settings.method === 'data-uri') {
      const tiny = await scaleDown(pixels, settings.size, codecs)
      const bytes = await codecs.encode(DATA_URI_ENCODE, tiny)
      value.dataUri = `data:image/webp;base64,${bytesToBase64(bytes)}`
    } else {
      const small = flatten(await scaleDown(pixels, BLURHASH_EDGE, codecs), [255, 255, 255, 255])
      value.blurhash = encodeBlurhash(small, settings.componentsX, settings.componentsY)
    }
    const name = nameWithEnding(item.meta.name, '.placeholder.json')
    return [{ port: 'out', item: jsonItem(name, value, item.meta.source) }]
  },
})

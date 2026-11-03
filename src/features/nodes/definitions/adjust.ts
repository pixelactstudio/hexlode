import { z } from 'zod'

import { asImage, codecsOf, pixelsOf, withPixels } from '#/features/images/image-item'
import { adjustTone, isNeutral } from '#/features/images/tone'
import { ALL_IMAGE_TYPES, OUTPUT_PORT } from '#/features/nodes/constants'
import { PIXEL_OP_MS_PER_MEGAPIXEL, pixelCost } from '#/features/nodes/cost'
import { defineNode } from '#/features/nodes/define-node'

const level = z.number().min(-100).max(100).default(0)

export const adjustNode = defineNode({
  type: 'adjust',
  label: 'Adjust',
  category: 'colour',
  description: 'Changes brightness, contrast, saturation and exposure.',
  schema: z.object({
    brightness: level,
    contrast: level,
    saturation: level,
    exposure: z.number().min(-3).max(3).default(0),
  }),
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: (_settings, input) => input,
  simulate: (settings, meta) => [
    { port: 'out', meta: isNeutral(settings) ? meta : { ...meta, size: undefined } },
  ],
  cost: (settings, meta) =>
    isNeutral(settings)
      ? { ms: 0, encodes: 0, needsPixels: false }
      : pixelCost(meta, PIXEL_OP_MS_PER_MEGAPIXEL),
  async run(input, settings, context) {
    if (input.mode !== 'each') throw new Error('Adjust runs per item.')
    const item = asImage(input.item)
    if (isNeutral(settings)) return [{ port: 'out', item }]
    const pixels = await pixelsOf(item, codecsOf(context))
    return [{ port: 'out', item: withPixels(item, adjustTone(pixels, settings)) }]
  },
})

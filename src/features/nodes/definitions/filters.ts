import { z } from 'zod'

import { rgbaOf } from '#/features/images/colour'
import { asImage, codecsOf, pixelsOf, withPixels } from '#/features/images/image-item'
import { applyFilter } from '#/features/images/tone'
import { ALL_IMAGE_TYPES, OUTPUT_PORT } from '#/features/nodes/constants'
import { PIXEL_OP_MS_PER_MEGAPIXEL, pixelCost } from '#/features/nodes/cost'
import { defineNode } from '#/features/nodes/define-node'
import { colour } from '#/features/nodes/validators'

const FILTERS = ['grayscale', 'sepia', 'duotone', 'invert'] as const

export const filtersNode = defineNode({
  type: 'filters',
  label: 'Filters',
  category: 'colour',
  description: 'Applies grayscale, sepia, duotone or invert.',
  schema: z.object({
    filter: z.enum(FILTERS).default('grayscale'),
    strength: z.number().min(0).max(100).default(100),
    shadows: colour('#1e1b4b'),
    highlights: colour('#fbbf24'),
  }),
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: (_settings, input) => input,
  simulate: (settings, meta) => [
    { port: 'out', meta: settings.strength === 0 ? meta : { ...meta, size: undefined } },
  ],
  cost: (_settings, meta) => pixelCost(meta, PIXEL_OP_MS_PER_MEGAPIXEL),
  async run(input, settings, context) {
    if (input.mode !== 'each') throw new Error('Filters runs per item.')
    const item = asImage(input.item)
    if (settings.strength === 0) return [{ port: 'out', item }]
    const pixels = await pixelsOf(item, codecsOf(context))
    const result = applyFilter(pixels, {
      filter: settings.filter,
      strength: settings.strength,
      shadows: rgbaOf(settings.shadows),
      highlights: rgbaOf(settings.highlights),
    })
    return [{ port: 'out', item: withPixels(item, result) }]
  },
})

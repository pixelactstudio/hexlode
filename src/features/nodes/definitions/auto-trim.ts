import { z } from 'zod'

import { asImage, codecsOf, pixelsOf, withPixels } from '#/features/images/image-item'
import { crop } from '#/features/images/pixel-ops'
import { padArea, trimBounds } from '#/features/images/shape'
import { ALL_IMAGE_TYPES, OUTPUT_PORT } from '#/features/nodes/constants'
import { PIXEL_OP_MS_PER_MEGAPIXEL, pixelCost } from '#/features/nodes/cost'
import { defineNode } from '#/features/nodes/define-node'

export const autoTrimNode = defineNode({
  type: 'auto-trim',
  label: 'Auto-trim',
  category: 'size',
  description: 'Removes plain-colour or transparent borders.',
  schema: z.object({
    /** How far a colour may be from the corner's colour and still count as border, 0 to 100. */
    tolerance: z.number().min(0).max(100).default(10),
    /** Border pixels to keep on every side. */
    padding: z.number().int().min(0).max(1000).default(0),
  }),
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: (_settings, input) => input,
  cost: (_settings, meta) => pixelCost(meta, PIXEL_OP_MS_PER_MEGAPIXEL),
  async run(input, settings, context) {
    if (input.mode !== 'each') throw new Error('Auto-trim runs per item.')
    const item = asImage(input.item)
    const pixels = await pixelsOf(item, codecsOf(context))
    const bounds = trimBounds(pixels, settings.tolerance)
    if (!bounds) return [{ port: 'out', item }]
    const area = padArea(bounds, settings.padding, pixels.width, pixels.height)
    if (area.width === pixels.width && area.height === pixels.height) {
      return [{ port: 'out', item }]
    }
    const trimmed = crop(pixels, area.x, area.y, area.width, area.height)
    return [{ port: 'out', item: withPixels(item, trimmed) }]
  },
})

import { z } from 'zod'
import { rgbaOf } from '#/features/images/colour'
import { flatten } from '#/features/images/compose'
import { asImage, codecsOf, pixelsOf, withPixels } from '#/features/images/image-item'
import { hasTransparency } from '#/features/images/pixel-ops'
import { ALL_IMAGE_TYPES, OUTPUT_PORT } from '#/features/nodes/constants'
import { PIXEL_OP_MS_PER_MEGAPIXEL, pixelCost } from '#/features/nodes/cost'
import { defineNode } from '#/features/nodes/define-node'
import { colour } from '#/features/nodes/validators'

export const backgroundNode = defineNode({
  type: 'background',
  label: 'Background',
  category: 'colour',
  description: 'Replaces transparency with a colour.',
  schema: z.object({ colour: colour('#ffffff') }),
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: (_settings, input) => input,
  simulate: (_settings, meta) => [{ port: 'out', meta }],
  cost: (_settings, meta) =>
    meta.format === 'jpeg'
      ? { ms: 0, encodes: 0, needsPixels: false }
      : pixelCost(meta, PIXEL_OP_MS_PER_MEGAPIXEL),
  async run(input, settings, context) {
    if (input.mode !== 'each') throw new Error('Background runs per item.')
    const item = asImage(input.item)
    // JPEG has no transparency to replace.
    if (item.meta.format === 'jpeg') return [{ port: 'out', item }]
    const pixels = await pixelsOf(item, codecsOf(context))
    if (!hasTransparency(pixels)) return [{ port: 'out', item }]
    return [{ port: 'out', item: withPixels(item, flatten(pixels, rgbaOf(settings.colour))) }]
  },
})

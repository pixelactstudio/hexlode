import { z } from 'zod'

import { asImage, codecsOf, pixelsOf, withPixels } from '#/features/images/image-item'
import { scalePixelArt } from '#/features/images/shape'
import { ALL_IMAGE_TYPES, MAX_RESIZE_DIMENSION, OUTPUT_PORT } from '#/features/nodes/constants'
import { PIXEL_OP_MS_PER_MEGAPIXEL, pixelCost } from '#/features/nodes/cost'
import { defineNode } from '#/features/nodes/define-node'

export const pixelArtNode = defineNode({
  type: 'pixel-art',
  label: 'Pixel-art upscale',
  category: 'size',
  description: 'Enlarges pixel art 2x to 4x with sharp edges.',
  schema: z.object({
    scale: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(2),
    /** Nearest copies each pixel into a block; smooth also rounds off diagonal steps. */
    method: z.enum(['nearest', 'smooth']).default('nearest'),
  }),
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: (_settings, input) => input,
  simulate: (settings, meta) => [
    {
      port: 'out',
      meta: {
        ...meta,
        width: (meta.width ?? 0) * settings.scale,
        height: (meta.height ?? 0) * settings.scale,
        size: undefined,
      },
    },
  ],
  cost: (settings, meta) => pixelCost(meta, PIXEL_OP_MS_PER_MEGAPIXEL * settings.scale ** 2),
  async run(input, settings, context) {
    if (input.mode !== 'each') throw new Error('Pixel-art upscale runs per item.')
    const item = asImage(input.item)
    const longest = Math.max(item.meta.width ?? 0, item.meta.height ?? 0) * settings.scale
    if (longest > MAX_RESIZE_DIMENSION) {
      throw new Error(
        `Enlarged ${settings.scale}x, this image would be ${longest.toLocaleString('en')} pixels long. The limit is ${MAX_RESIZE_DIMENSION.toLocaleString('en')}.`,
      )
    }
    const pixels = await pixelsOf(item, codecsOf(context))
    const scaled = scalePixelArt(pixels, settings.scale, settings.method)
    return [{ port: 'out', item: withPixels(item, scaled) }]
  },
})

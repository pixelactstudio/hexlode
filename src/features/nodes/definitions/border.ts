import { z } from 'zod'

import type { ItemMeta } from '#/features/engine/types'
import { rgbaOf } from '#/features/images/colour'
import { canvas, drawOver, roundCorners } from '#/features/images/compose'
import { asImage, codecsOf, pixelsOf, withPixels } from '#/features/images/image-item'
import { ALL_IMAGE_TYPES, OUTPUT_PORT } from '#/features/nodes/constants'
import { PIXEL_OP_MS_PER_MEGAPIXEL, pixelCost } from '#/features/nodes/cost'
import { defineNode } from '#/features/nodes/define-node'
import { colour } from '#/features/nodes/validators'

const schema = z.object({
  /** Border and radius in percent of the shorter edge, or in pixels. */
  unit: z.enum(['percent', 'pixels']).default('percent'),
  border: z.number().min(0).max(1000).default(3),
  borderColour: colour('#ffffff'),
  radius: z.number().min(0).max(1000).default(0),
  /** What shows outside rounded corners. Transparency needs a format that keeps it. */
  corners: z.enum(['transparent', 'colour']).default('transparent'),
  cornerColour: colour('#ffffff'),
})

type BorderSettings = z.infer<typeof schema>

/** Border width and corner radius in pixels for an image of this size. */
function borderPixels(settings: BorderSettings, meta: Pick<ItemMeta, 'width' | 'height'>) {
  const shorter = Math.min(meta.width ?? 0, meta.height ?? 0)
  const toPixels = (value: number) => (settings.unit === 'pixels' ? value : (value / 100) * shorter)
  return { border: Math.round(toPixels(settings.border)), radius: toPixels(settings.radius) }
}

export const borderNode = defineNode({
  type: 'border',
  label: 'Border / Rounded corners',
  category: 'overlay',
  description: 'Adds a frame or rounds the corners.',
  schema,
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: (_settings, input) => input,
  simulate: (settings, meta) => {
    const { border } = borderPixels(settings, meta)
    return [
      {
        port: 'out',
        meta: {
          ...meta,
          width: (meta.width ?? 0) + border * 2,
          height: (meta.height ?? 0) + border * 2,
          size: undefined,
        },
      },
    ]
  },
  cost: (_settings, meta) => pixelCost(meta, PIXEL_OP_MS_PER_MEGAPIXEL),
  async run(input, settings, context) {
    if (input.mode !== 'each') throw new Error('Border / Rounded corners runs per item.')
    const item = asImage(input.item)
    const { border, radius } = borderPixels(settings, item.meta)
    if (border === 0 && radius <= 0) return [{ port: 'out', item }]
    let pixels = await pixelsOf(item, codecsOf(context))
    if (border > 0) {
      const framed = canvas(
        pixels.width + border * 2,
        pixels.height + border * 2,
        rgbaOf(settings.borderColour),
      )
      pixels = drawOver(framed, pixels, border, border)
    }
    if (radius > 0) {
      const fill = settings.corners === 'colour' ? rgbaOf(settings.cornerColour) : null
      pixels = roundCorners(pixels, radius, fill)
    }
    return [{ port: 'out', item: withPixels(item, pixels) }]
  },
})

import { z } from 'zod'

import { asImage, codecsOf, pixelsOf, withPixels } from '#/features/images/image-item'
import { setExifOrientation } from '#/features/images/metadata/exif'
import { applyOrientation, flip, rotate } from '#/features/images/pixel-ops'
import { ALL_IMAGE_TYPES, OUTPUT_PORT } from '#/features/nodes/constants'
import { PIXEL_OP_MS_PER_MEGAPIXEL, pixelCost } from '#/features/nodes/cost'
import { defineNode } from '#/features/nodes/define-node'

const schema = z.object({
  auto: z.boolean().default(true),
  rotate: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0),
  flipHorizontal: z.boolean().default(false),
  flipVertical: z.boolean().default(false),
})

type RotateSettings = z.infer<typeof schema>

function isQuarterTurn(settings: RotateSettings, orientation: number) {
  const turnedByTag = settings.auto && orientation >= 5
  return turnedByTag !== (settings.rotate === 90 || settings.rotate === 270)
}

export const rotateNode = defineNode({
  type: 'rotate',
  label: 'Rotate / Flip',
  category: 'size',
  description: 'Rotates and flips, including automatic rotation from the camera orientation tag.',
  schema,
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: (_settings, input) => input,
  simulate: (settings, meta) => {
    const swap = isQuarterTurn(settings, meta.orientation ?? 1)
    return [
      {
        port: 'out',
        meta: {
          ...meta,
          width: swap ? meta.height : meta.width,
          height: swap ? meta.width : meta.height,
          orientation: settings.auto ? 1 : meta.orientation,
          size: undefined,
        },
      },
    ]
  },
  cost: (_settings, meta) => pixelCost(meta, PIXEL_OP_MS_PER_MEGAPIXEL),
  async run(input, settings, context) {
    if (input.mode !== 'each') throw new Error('Rotate / Flip runs per item.')
    const item = asImage(input.item)
    const orientation = item.meta.orientation ?? 1
    const applyTag = settings.auto && orientation !== 1
    const nothingToDo =
      !applyTag && settings.rotate === 0 && !settings.flipHorizontal && !settings.flipVertical
    if (nothingToDo) return [{ port: 'out', item }]
    let pixels = await pixelsOf(item, codecsOf(context))
    if (applyTag) pixels = applyOrientation(pixels, orientation)
    pixels = rotate(pixels, settings.rotate)
    if (settings.flipHorizontal) pixels = flip(pixels, 'horizontal')
    if (settings.flipVertical) pixels = flip(pixels, 'vertical')
    const result = withPixels(item, pixels, applyTag ? { orientation: 1 } : {})
    const { exif } = result.payload.metadata
    if (applyTag && exif) {
      result.payload.metadata = { ...result.payload.metadata, exif: setExifOrientation(exif, 1) }
    }
    return [{ port: 'out', item: result }]
  },
})

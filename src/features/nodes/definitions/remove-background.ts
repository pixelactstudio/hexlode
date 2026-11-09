import { z } from 'zod'

import { BACKGROUND_MODEL, CUT_OUT_MS_PER_MEGAPIXEL } from '#/features/background-removal/constants'
import { cutOut, scaleMask } from '#/features/background-removal/mask'
import { segmenterOf } from '#/features/background-removal/segmenter'
import type { ItemMeta, ItemType, ItemTypeSet } from '#/features/engine/types'
import {
  asImage,
  codecsOf,
  replaceExtension,
  uprightMeta,
  uprightPixelsOf,
  withUprightPixels,
} from '#/features/images/image-item'
import { ALL_IMAGE_TYPES, OUTPUT_PORT } from '#/features/nodes/constants'
import { megapixels, RESIZE_MS_PER_MEGAPIXEL } from '#/features/nodes/cost'
import { defineNode } from '#/features/nodes/define-node'

/** JPEG cannot hold transparency, so its cut-outs become PNG. Every other format keeps it. */
function cutOutMeta(meta: ItemMeta): ItemMeta {
  const upright = uprightMeta(meta)
  if (meta.format !== 'jpeg') return upright
  return { ...upright, format: 'png', name: replaceExtension(meta.name, 'png') }
}

export const removeBackgroundNode = defineNode({
  type: 'remove-background',
  label: 'Remove background',
  category: 'colour',
  description:
    'Cuts the subject out onto transparency with a model that runs on the device. JPEG becomes PNG.',
  schema: z.object({}),
  models: [BACKGROUND_MODEL.id],
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: (_settings, input): ItemTypeSet => {
    const types = new Set<ItemType>(input)
    if (types.delete('image:jpeg')) types.add('image:png')
    return types
  },
  simulate: (_settings, meta) => [{ port: 'out', meta: cutOutMeta(meta) }],
  cost: (_settings, meta) => ({
    ms: (RESIZE_MS_PER_MEGAPIXEL + CUT_OUT_MS_PER_MEGAPIXEL) * megapixels(meta),
    encodes: 0,
    needsPixels: true,
    model: { id: BACKGROUND_MODEL.id, runs: 1 },
  }),
  async run(input, _settings, context) {
    if (input.mode !== 'each') throw new Error('Remove background runs per item.')
    const item = asImage(input.item)
    const codecs = codecsOf(context)
    const segmenter = segmenterOf(context)
    // Models are trained on upright photos.
    const pixels = await uprightPixelsOf(item, codecs)
    const size = segmenter.inputSize
    const small = await codecs.resize(pixels, size, size, 'triangle')
    const mask = await segmenter.segment(small, context.signal)
    if (!mask.some((value) => value > 0)) {
      context.warn({
        code: 'no_subject',
        message: 'No subject was found, so the image is fully transparent.',
      })
    }
    const result = withUprightPixels(
      item,
      cutOut(pixels, scaleMask(mask, size, pixels.width, pixels.height)),
    )
    const meta = cutOutMeta(item.meta)
    return [
      {
        port: 'out',
        item: {
          meta: { ...result.meta, format: meta.format, name: meta.name },
          payload: result.payload,
        },
      },
    ]
  },
})

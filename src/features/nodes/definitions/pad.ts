import { z } from 'zod'

import { gaussianBlur } from '#/features/images/blur'
import { rgbaOf } from '#/features/images/colour'
import { canvas, drawOver } from '#/features/images/compose'
import {
  asImage,
  codecsOf,
  uprightMeta,
  uprightPixelsOf,
  withUprightPixels,
} from '#/features/images/image-item'
import { crop, displaySize } from '#/features/images/pixel-ops'
import type { Codecs, Pixels } from '#/features/images/types'
import { ALL_IMAGE_TYPES, OUTPUT_PORT } from '#/features/nodes/constants'
import { PIXEL_OP_MS_PER_MEGAPIXEL, pixelCost } from '#/features/nodes/cost'
import { defineNode } from '#/features/nodes/define-node'
import { aspectFields, placeAt, ratioOf } from '#/features/nodes/definitions/crop'
import { colour } from '#/features/nodes/validators'

const schema = z.object({
  ...aspectFields,
  fill: z.enum(['colour', 'blur']).default('colour'),
  colour: colour('#ffffff'),
})

type PadSettings = z.infer<typeof schema>

/** The blurred fill is built this small, then scaled up, which also softens it. */
const BLUR_FILL_EDGE = 96
/** Blur strength of the fill, as a share of its longest edge. */
const BLUR_FILL_SIGMA = 0.04

/** The canvas that gives an upright image the chosen ratio, and where the image sits on it. */
function planPad(settings: PadSettings, width: number, height: number) {
  const ratio = ratioOf(settings)
  // Narrower than the ratio: add width. Otherwise add height.
  const size =
    width / height < ratio
      ? { width: Math.max(width, Math.round(height * ratio)), height }
      : { width, height: Math.max(height, Math.round(width / ratio)) }
  return { ...size, ...placeAt(settings.position, size.width - width, size.height - height) }
}

/** The image scaled to cover the canvas, blurred. */
async function blurredFill(pixels: Pixels, width: number, height: number, codecs: Codecs) {
  const shrink = Math.min(1, BLUR_FILL_EDGE / Math.max(width, height))
  const small = {
    width: Math.max(1, Math.round(width * shrink)),
    height: Math.max(1, Math.round(height * shrink)),
  }
  const cover = Math.max(small.width / pixels.width, small.height / pixels.height)
  const scaled = await codecs.resize(
    pixels,
    Math.max(small.width, Math.round(pixels.width * cover)),
    Math.max(small.height, Math.round(pixels.height * cover)),
    'triangle',
  )
  const centred = crop(
    scaled,
    Math.floor((scaled.width - small.width) / 2),
    Math.floor((scaled.height - small.height) / 2),
    small.width,
    small.height,
  )
  const blurred = gaussianBlur(centred, Math.max(small.width, small.height) * BLUR_FILL_SIGMA)
  return codecs.resize(blurred, width, height, 'triangle')
}

export const padNode = defineNode({
  type: 'pad',
  label: 'Pad / Extend',
  category: 'size',
  description:
    'Adds space to reach an aspect ratio, filled with a colour or a blurred copy of the image.',
  schema,
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: (_settings, input) => input,
  simulate: (settings, meta) => {
    const upright = displaySize(meta)
    const plan = planPad(settings, upright.width, upright.height)
    if (plan.width === upright.width && plan.height === upright.height) {
      return [{ port: 'out', meta }]
    }
    return [{ port: 'out', meta: { ...uprightMeta(meta), width: plan.width, height: plan.height } }]
  },
  cost: (_settings, meta) => pixelCost(meta, PIXEL_OP_MS_PER_MEGAPIXEL * 2),
  async run(input, settings, context) {
    if (input.mode !== 'each') throw new Error('Pad / Extend runs per item.')
    const item = asImage(input.item)
    const upright = displaySize(item.meta)
    const plan = planPad(settings, upright.width, upright.height)
    if (plan.width === upright.width && plan.height === upright.height) {
      return [{ port: 'out', item }]
    }
    const codecs = codecsOf(context)
    const pixels = await uprightPixelsOf(item, codecs)
    const base =
      settings.fill === 'blur'
        ? await blurredFill(pixels, plan.width, plan.height, codecs)
        : canvas(plan.width, plan.height, rgbaOf(settings.colour))
    return [{ port: 'out', item: withUprightPixels(item, drawOver(base, pixels, plan.x, plan.y)) }]
  },
})

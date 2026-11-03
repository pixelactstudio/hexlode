import { z } from 'zod'

import { gaussianBlur, sharpen } from '#/features/images/blur'
import {
  asImage,
  codecsOf,
  pixelsOf,
  uprightMeta,
  uprightPixelsOf,
  withPixels,
  withUprightPixels,
} from '#/features/images/image-item'
import { crop } from '#/features/images/pixel-ops'
import type { Pixels } from '#/features/images/types'
import { ALL_IMAGE_TYPES, OUTPUT_PORT } from '#/features/nodes/constants'
import { pixelCost } from '#/features/nodes/cost'
import { defineNode } from '#/features/nodes/define-node'

const percent = (value: number) => z.number().min(0).max(100).default(value)

const schema = z.object({
  effect: z.enum(['sharpen', 'blur']).default('sharpen'),
  /** The blur's standard deviation in pixels. Sharpening works at the scale of this blur. */
  radius: z.number().min(0.5).max(100).default(1),
  /** Sharpening strength in percent of the detail added back. */
  amount: z.number().min(0).max(500).default(100),
  region: z.enum(['whole', 'area']).default('whole'),
  /** The area as percentages of the upright image. */
  area: z
    .object({ x: percent(25), y: percent(25), width: percent(50), height: percent(50) })
    .prefault({}),
})

type SharpenBlurSettings = z.infer<typeof schema>

/** Box blurs cost the same at any radius: six passes over every pixel. */
const BLUR_MS_PER_MEGAPIXEL = 40

function effect(pixels: Pixels, settings: SharpenBlurSettings) {
  return settings.effect === 'blur'
    ? gaussianBlur(pixels, settings.radius)
    : sharpen(pixels, settings.radius, settings.amount / 100)
}

/** Applies the effect to the area only, reading pixels around it so its edges blend. */
function effectInArea(pixels: Pixels, settings: SharpenBlurSettings) {
  const { area } = settings
  const x = Math.round((area.x / 100) * pixels.width)
  const y = Math.round((area.y / 100) * pixels.height)
  const right = Math.min(pixels.width, Math.round(((area.x + area.width) / 100) * pixels.width))
  const bottom = Math.min(pixels.height, Math.round(((area.y + area.height) / 100) * pixels.height))
  if (right <= x || bottom <= y) return pixels
  const margin = Math.ceil(settings.radius * 3)
  const left = Math.max(0, x - margin)
  const top = Math.max(0, y - margin)
  const around = crop(
    pixels,
    left,
    top,
    Math.min(pixels.width, right + margin) - left,
    Math.min(pixels.height, bottom + margin) - top,
  )
  const changed = crop(effect(around, settings), x - left, y - top, right - x, bottom - y)
  const result = { ...pixels, data: new Uint8ClampedArray(pixels.data) }
  // Opaque copy: replace the area's pixels instead of blending over them.
  for (let row = 0; row < changed.height; row += 1) {
    const from = row * changed.width * 4
    result.data.set(
      changed.data.subarray(from, from + changed.width * 4),
      ((y + row) * pixels.width + x) * 4,
    )
  }
  return result
}

export const sharpenBlurNode = defineNode({
  type: 'sharpen-blur',
  label: 'Sharpen / Blur',
  category: 'colour',
  description: 'Sharpens, or blurs the whole image or a region.',
  schema,
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: (_settings, input) => input,
  simulate: (settings, meta) => [
    {
      port: 'out',
      meta: settings.region === 'area' ? uprightMeta(meta) : { ...meta, size: undefined },
    },
  ],
  cost: (_settings, meta) => pixelCost(meta, BLUR_MS_PER_MEGAPIXEL),
  async run(input, settings, context) {
    if (input.mode !== 'each') throw new Error('Sharpen / Blur runs per item.')
    const item = asImage(input.item)
    const codecs = codecsOf(context)
    if (settings.effect === 'sharpen' && settings.amount === 0) return [{ port: 'out', item }]
    if (settings.region === 'whole') {
      return [
        { port: 'out', item: withPixels(item, effect(await pixelsOf(item, codecs), settings)) },
      ]
    }
    // The area is measured on the upright image, so turn it upright first.
    const upright = await uprightPixelsOf(item, codecs)
    return [{ port: 'out', item: withUprightPixels(item, effectInArea(upright, settings)) }]
  },
})

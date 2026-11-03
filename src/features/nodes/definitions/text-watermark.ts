import { z } from 'zod'

import { rgbaOf } from '#/features/images/colour'
import { drawOver } from '#/features/images/compose'
import {
  asImage,
  codecsOf,
  uprightMeta,
  uprightPixelsOf,
  withUprightPixels,
} from '#/features/images/image-item'
import { renderText } from '#/features/images/text'
import type { Pixels } from '#/features/images/types'
import { ALL_IMAGE_TYPES, OUTPUT_PORT } from '#/features/nodes/constants'
import { PIXEL_OP_MS_PER_MEGAPIXEL, pixelCost } from '#/features/nodes/cost'
import { defineNode } from '#/features/nodes/define-node'
import { CROP_POSITIONS, placeAt } from '#/features/nodes/definitions/crop'
import { colour } from '#/features/nodes/validators'

const schema = z.object({
  text: z.string().max(200).default('© Your name'),
  position: z.enum(CROP_POSITIONS).default('bottom-right'),
  /** Font size in percent of the image's shorter edge. */
  size: z.number().min(1).max(50).default(4),
  opacity: z.number().min(0).max(100).default(60),
  colour: colour('#ffffff'),
  font: z.enum(['sans-serif', 'serif', 'monospace']).default('sans-serif'),
  bold: z.boolean().default(true),
  /** Space between the text and the edge, in percent of the shorter edge. */
  margin: z.number().min(0).max(50).default(3),
  /** Repeat the text across the whole image instead of placing it once. */
  tile: z.boolean().default(false),
  /** Rotation of tiled text in degrees. */
  angle: z.number().min(-90).max(90).default(-30),
})

type TextWatermarkSettings = z.infer<typeof schema>

/** Tiled text repeats with this much space between copies, in font sizes. */
const TILE_GAP = 1.5

function placeTiles(base: Pixels, mark: Pixels, gap: number, opacity: number) {
  const stepX = mark.width + gap
  const stepY = mark.height + gap
  for (let row = 0, y = -mark.height / 2; y < base.height; row += 1, y += stepY) {
    const shift = row % 2 === 0 ? 0 : stepX / 2
    for (let x = -stepX + shift; x < base.width; x += stepX) {
      drawOver(base, mark, Math.round(x), Math.round(y), opacity)
    }
  }
  return base
}

function watermark(pixels: Pixels, settings: TextWatermarkSettings) {
  const shorter = Math.min(pixels.width, pixels.height)
  const fontSize = Math.max(1, Math.round((settings.size / 100) * shorter))
  const rgba = rgbaOf(settings.colour)
  const opacity = (settings.opacity / 100) * (rgba[3] / 255)
  const mark = renderText(settings.text.trim(), {
    size: fontSize,
    colour: rgba,
    family: settings.font,
    bold: settings.bold,
    angle: settings.tile ? settings.angle : 0,
  })
  const base: Pixels = { ...pixels, data: new Uint8ClampedArray(pixels.data) }
  if (settings.tile) return placeTiles(base, mark, Math.round(fontSize * TILE_GAP), opacity)
  const margin = Math.round((settings.margin / 100) * shorter)
  const spot = placeAt(
    settings.position,
    Math.max(0, pixels.width - mark.width - margin * 2),
    Math.max(0, pixels.height - mark.height - margin * 2),
  )
  return drawOver(base, mark, spot.x + margin, spot.y + margin, opacity)
}

export const textWatermarkNode = defineNode({
  type: 'text-watermark',
  label: 'Text watermark',
  category: 'overlay',
  description: 'Places text with position, size, opacity and an optional repeated tile.',
  privateSettings: ['text'],
  schema,
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: (_settings, input) => input,
  simulate: (settings, meta) => [
    { port: 'out', meta: settings.text.trim() ? uprightMeta(meta) : meta },
  ],
  cost: (_settings, meta) => pixelCost(meta, PIXEL_OP_MS_PER_MEGAPIXEL),
  async run(input, settings, context) {
    if (input.mode !== 'each') throw new Error('Text watermark runs per item.')
    const item = asImage(input.item)
    if (!settings.text.trim() || settings.opacity === 0) return [{ port: 'out', item }]
    // Positions follow the image as it is shown, so turned photos are made upright first.
    const pixels = await uprightPixelsOf(item, codecsOf(context))
    return [{ port: 'out', item: withUprightPixels(item, watermark(pixels, settings)) }]
  },
})

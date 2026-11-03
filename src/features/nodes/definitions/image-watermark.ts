import { z } from 'zod'

import { inspectImageHeader } from '#/features/image-input/validators'
import { drawOver } from '#/features/images/compose'
import {
  asImage,
  codecsOf,
  uprightMeta,
  uprightPixelsOf,
  withUprightPixels,
} from '#/features/images/image-item'
import type { Codecs, Pixels } from '#/features/images/types'
import { ALL_IMAGE_TYPES, MAX_LOGO_BYTES, OUTPUT_PORT } from '#/features/nodes/constants'
import { PIXEL_OP_MS_PER_MEGAPIXEL, pixelCost } from '#/features/nodes/cost'
import { defineNode } from '#/features/nodes/define-node'
import { CROP_POSITIONS, placeAt } from '#/features/nodes/definitions/crop'
import { base64ToBytes } from '#/lib/base64'

/** A logo chosen in the Studio: PNG or WebP bytes in base64. SVG logos are drawn to PNG. */
const logoSchema = z.object({
  name: z.string().max(200),
  data: z.string().max(Math.ceil(MAX_LOGO_BYTES / 3) * 4),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
})

export type Logo = z.infer<typeof logoSchema>

const schema = z.object({
  logo: logoSchema.nullable().default(null),
  position: z.enum(CROP_POSITIONS).default('bottom-right'),
  /** Logo width in percent of the image width. */
  scale: z.number().min(1).max(100).default(20),
  opacity: z.number().min(0).max(100).default(80),
  /** Space between the logo and the edge, in percent of the shorter edge. */
  margin: z.number().min(0).max(50).default(3),
})

/** The last logo this worker decoded, so a batch decodes it once. */
let decoded: { data: string; pixels: Promise<Pixels> } | undefined

function logoPixels(logo: Logo, codecs: Codecs) {
  if (decoded?.data !== logo.data) {
    const bytes = base64ToBytes(logo.data)
    const { format } = inspectImageHeader(bytes.slice().buffer)
    decoded = { data: logo.data, pixels: codecs.decode(format, bytes) }
  }
  return decoded.pixels
}

export const imageWatermarkNode = defineNode({
  type: 'image-watermark',
  label: 'Image watermark',
  category: 'overlay',
  description: 'Places a logo (PNG, WebP or SVG) with position, scale and opacity.',
  privateSettings: ['logo'],
  schema,
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: (_settings, input) => input,
  simulate: (settings, meta) => [{ port: 'out', meta: settings.logo ? uprightMeta(meta) : meta }],
  cost: (_settings, meta) => pixelCost(meta, PIXEL_OP_MS_PER_MEGAPIXEL),
  async run(input, settings, context) {
    if (input.mode !== 'each') throw new Error('Image watermark runs per item.')
    const item = asImage(input.item)
    if (!settings.logo) {
      context.warn({
        code: 'no_logo',
        message: 'No logo is chosen, so images pass through unchanged.',
      })
      return [{ port: 'out', item }]
    }
    if (settings.opacity === 0) return [{ port: 'out', item }]
    const codecs = codecsOf(context)
    // Positions follow the image as it is shown, so turned photos are made upright first.
    const pixels = await uprightPixelsOf(item, codecs)
    const logo = await logoPixels(settings.logo, codecs)
    const width = Math.max(1, Math.round((settings.scale / 100) * pixels.width))
    const height = Math.max(1, Math.round((width * logo.height) / logo.width))
    const scaled =
      width === logo.width && height === logo.height
        ? logo
        : await codecs.resize(logo, width, height, 'lanczos3')
    const margin = Math.round((settings.margin / 100) * Math.min(pixels.width, pixels.height))
    const spot = placeAt(
      settings.position,
      Math.max(0, pixels.width - width - margin * 2),
      Math.max(0, pixels.height - height - margin * 2),
    )
    const base: Pixels = { ...pixels, data: new Uint8ClampedArray(pixels.data) }
    drawOver(base, scaled, spot.x + margin, spot.y + margin, settings.opacity / 100)
    return [{ port: 'out', item: withUprightPixels(item, base) }]
  },
})

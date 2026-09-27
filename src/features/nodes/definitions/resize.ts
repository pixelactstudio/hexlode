import { z } from 'zod'

import type { ItemMeta } from '#/features/engine/types'
import { asImage, codecsOf, pixelsOf, withPixels } from '#/features/images/image-item'
import { crop } from '#/features/images/pixel-ops'
import {
  ALL_IMAGE_TYPES,
  DEFAULT_LONGEST_EDGE,
  MAX_RESIZE_DIMENSION,
  OUTPUT_PORT,
} from '#/features/nodes/constants'
import { pixelCost, RESIZE_MS_PER_MEGAPIXEL } from '#/features/nodes/cost'
import { defineNode } from '#/features/nodes/define-node'

const dimension = (value: number) =>
  z.number().int().min(1).max(MAX_RESIZE_DIMENSION).default(value)

const schema = z.object({
  mode: z.enum(['longestEdge', 'width', 'height', 'percent', 'box']).default('longestEdge'),
  longestEdge: dimension(DEFAULT_LONGEST_EDGE),
  width: dimension(1920),
  height: dimension(1080),
  percent: z.number().min(1).max(1000).default(50),
  fit: z.enum(['fit', 'fill', 'exact']).default('fit'),
  method: z.enum(['lanczos3', 'mitchell', 'catrom', 'triangle']).default('lanczos3'),
  allowUpscale: z.boolean().default(false),
})

export type ResizeSettings = z.infer<typeof schema>

export interface ResizePlan {
  /** Size to scale to. */
  width: number
  height: number
  /** Area to keep after scaling, for fill. */
  crop?: { x: number; y: number; width: number; height: number }
}

const round = (value: number) => Math.max(1, Math.round(value))

/** Works in upright (displayed) dimensions. Callers swap for quarter-turn orientations. */
export function planResize(settings: ResizeSettings, width: number, height: number): ResizePlan {
  const limit = (scale: number) => (settings.allowUpscale ? scale : Math.min(scale, 1))
  const scaled = (scale: number) => ({ width: round(width * scale), height: round(height * scale) })
  switch (settings.mode) {
    case 'longestEdge':
      return scaled(limit(settings.longestEdge / Math.max(width, height)))
    case 'width':
      return scaled(limit(settings.width / width))
    case 'height':
      return scaled(limit(settings.height / height))
    case 'percent':
      return scaled(limit(settings.percent / 100))
    case 'box': {
      if (settings.fit === 'exact') {
        return {
          width: settings.allowUpscale ? settings.width : Math.min(settings.width, width),
          height: settings.allowUpscale ? settings.height : Math.min(settings.height, height),
        }
      }
      if (settings.fit === 'fit') {
        return scaled(limit(Math.min(settings.width / width, settings.height / height)))
      }
      const scale = limit(Math.max(settings.width / width, settings.height / height))
      const size = scaled(scale)
      const cropWidth = Math.min(size.width, settings.width)
      const cropHeight = Math.min(size.height, settings.height)
      return {
        ...size,
        crop: {
          x: Math.floor((size.width - cropWidth) / 2),
          y: Math.floor((size.height - cropHeight) / 2),
          width: cropWidth,
          height: cropHeight,
        },
      }
    }
  }
}

/** The plan in stored pixel dimensions, for an image with the given orientation tag. */
export function planStoredResize(settings: ResizeSettings, meta: ItemMeta): ResizePlan {
  const turned = (meta.orientation ?? 1) >= 5
  const width = meta.width ?? 1
  const height = meta.height ?? 1
  if (!turned) return planResize(settings, width, height)
  const plan = planResize(settings, height, width)
  return {
    width: plan.height,
    height: plan.width,
    crop: plan.crop && {
      x: plan.crop.y,
      y: plan.crop.x,
      width: plan.crop.height,
      height: plan.crop.width,
    },
  }
}

function finalSize(plan: ResizePlan) {
  return plan.crop ? { width: plan.crop.width, height: plan.crop.height } : plan
}

export const resizeNode = defineNode({
  type: 'resize',
  label: 'Resize',
  category: 'size',
  description:
    'Resizes by width, height, percent or longest edge, with fit, fill or exact modes and a choice of resampling method.',
  schema,
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: (_settings, input) => input,
  simulate: (settings, meta) => {
    const size = finalSize(planStoredResize(settings, meta))
    return [{ port: 'out', meta: { ...meta, ...size, size: undefined } }]
  },
  cost: (_settings, meta) => pixelCost(meta, RESIZE_MS_PER_MEGAPIXEL),
  async run(input, settings, context) {
    if (input.mode !== 'each') throw new Error('Resize runs per item.')
    const item = asImage(input.item)
    const plan = planStoredResize(settings, item.meta)
    const unchanged =
      plan.width === item.meta.width && plan.height === item.meta.height && !plan.crop
    if (unchanged) return [{ port: 'out', item }]
    const codecs = codecsOf(context)
    let pixels = await pixelsOf(item, codecs)
    if (plan.width !== pixels.width || plan.height !== pixels.height) {
      pixels = await codecs.resize(pixels, plan.width, plan.height, settings.method)
    }
    if (plan.crop) {
      pixels = crop(pixels, plan.crop.x, plan.crop.y, plan.crop.width, plan.crop.height)
    }
    return [{ port: 'out', item: withPixels(item, pixels) }]
  },
})

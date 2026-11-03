import { z } from 'zod'

import type { ItemMeta } from '#/features/engine/types'
import {
  asImage,
  codecsOf,
  nameWithSuffix,
  uprightPixelsOf,
  withUprightPixels,
} from '#/features/images/image-item'
import { crop, displaySize } from '#/features/images/pixel-ops'
import { ALL_IMAGE_TYPES, OUTPUT_PORT } from '#/features/nodes/constants'
import { PIXEL_OP_MS_PER_MEGAPIXEL, pixelCost } from '#/features/nodes/cost'
import { defineNode } from '#/features/nodes/define-node'

const count = z.number().int().min(1).max(20)

const schema = z.object({ columns: count.default(3), rows: count.default(1) })

/** Tile edges along one side, spreading leftover pixels evenly. */
function edges(length: number, parts: number) {
  return Array.from({ length: parts + 1 }, (_, index) => Math.round((index * length) / parts))
}

/** Tiles of an upright image, left to right and top to bottom, with their numbered names. */
function planTiles(settings: z.infer<typeof schema>, meta: ItemMeta) {
  const { width, height } = displaySize(meta)
  const columns = Math.min(settings.columns, width)
  const rows = Math.min(settings.rows, height)
  const xs = edges(width, columns)
  const ys = edges(height, rows)
  const total = columns * rows
  const digits = String(total).length
  return Array.from({ length: total }, (_, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    return {
      name: nameWithSuffix(meta.name, `-${String(index + 1).padStart(digits, '0')}`),
      x: xs[column],
      y: ys[row],
      width: xs[column + 1] - xs[column],
      height: ys[row + 1] - ys[row],
    }
  })
}

export const splitNode = defineNode({
  type: 'split',
  label: 'Split / Tile',
  category: 'size',
  description: 'Cuts one image into a grid of images.',
  schema,
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: (_settings, input) => input,
  simulate: (settings, meta) =>
    planTiles(settings, meta).map((tile) => ({
      port: 'out',
      meta: {
        ...meta,
        name: tile.name,
        width: tile.width,
        height: tile.height,
        orientation: 1,
        size: undefined,
      },
    })),
  cost: (_settings, meta) => pixelCost(meta, PIXEL_OP_MS_PER_MEGAPIXEL),
  async run(input, settings, context) {
    if (input.mode !== 'each') throw new Error('Split / Tile runs per item.')
    const item = asImage(input.item)
    const tiles = planTiles(settings, item.meta)
    if (tiles.length === 1) return [{ port: 'out', item }]
    const upright = await uprightPixelsOf(item, codecsOf(context))
    return tiles.map((tile) => {
      const pixels = crop(upright, tile.x, tile.y, tile.width, tile.height)
      const result = withUprightPixels(item, pixels)
      return { port: 'out', item: { ...result, meta: { ...result.meta, name: tile.name } } }
    })
  },
})

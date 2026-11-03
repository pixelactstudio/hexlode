import { z } from 'zod'

import { typesOf } from '#/features/engine/item-types'
import { jsonItem, nameWithEnding, stemOf, textItem } from '#/features/file-items/file-item'
import { asImage, codecsOf, pixelsOf } from '#/features/images/image-item'
import { extractPalette, type PaletteColour } from '#/features/images/palette'
import { ALL_IMAGE_TYPES, OUTPUT_PORT } from '#/features/nodes/constants'
import { PIXEL_OP_MS_PER_MEGAPIXEL, pixelCost } from '#/features/nodes/cost'
import { defineNode } from '#/features/nodes/define-node'

const schema = z.object({
  count: z.number().int().min(1).max(16).default(6),
  format: z.enum(['json', 'css']).default('json'),
})

/** A CSS name from a file name: lowercase letters, digits and dashes. */
function cssName(name: string) {
  return (
    stemOf(name)
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/^-|-$/g, '') || 'image'
  )
}

function css(name: string, colours: PaletteColour[]) {
  const prefix = cssName(name)
  const lines = colours.map((colour, index) => `  --${prefix}-${index + 1}: ${colour.hex};`)
  return `:root {\n${lines.join('\n')}\n}\n`
}

export const paletteNode = defineNode({
  type: 'palette',
  label: 'Palette',
  category: 'output',
  description: 'Extracts the main colours as JSON or CSS variables.',
  schema,
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: (settings) => typesOf('data', [settings.format === 'css' ? 'text' : 'json']),
  cost: (_settings, meta) => pixelCost(meta, PIXEL_OP_MS_PER_MEGAPIXEL / 4),
  async run(input, settings, context) {
    if (input.mode !== 'each') throw new Error('Palette runs per item.')
    const item = asImage(input.item)
    const colours = extractPalette(await pixelsOf(item, codecsOf(context)), settings.count)
    const { name, source } = item.meta
    const output =
      settings.format === 'css'
        ? textItem('text', nameWithEnding(name, '.palette.css'), css(name, colours), source)
        : jsonItem(nameWithEnding(name, '.palette.json'), { image: name, colours }, source)
    return [{ port: 'out', item: output }]
  },
})

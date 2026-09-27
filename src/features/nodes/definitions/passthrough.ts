import { z } from 'zod'
import type { ImageFormat, ItemMeta } from '#/features/engine/types'
import { asImage, FORMAT_NAMES } from '#/features/images/image-item'
import { parseExif } from '#/features/images/metadata/exif'
import { displaySize } from '#/features/images/pixel-ops'
import { ALL_IMAGE_TYPES, OUTPUT_PORT } from '#/features/nodes/constants'
import { defineNode } from '#/features/nodes/define-node'

function formatName(meta: { format: string }) {
  return FORMAT_NAMES[meta.format as ImageFormat] ?? meta.format
}

const keepMeta = (_settings: Record<string, unknown>, meta: ItemMeta) => [{ port: 'out', meta }]

export const inspectNode = defineNode({
  type: 'inspect',
  label: 'Inspect',
  category: 'input',
  description:
    'Shows format, dimensions, size and metadata per item. Passes items through unchanged.',
  schema: z.object({}),
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: (_settings, input) => input,
  simulate: keepMeta,
  async run(input, _settings, context) {
    if (input.mode !== 'each') throw new Error('Inspect runs per item.')
    const item = asImage(input.item)
    const { metadata } = item.payload
    const exif = parseExif(metadata.exif)
    const size = displaySize(item.meta)
    context.record({
      name: item.meta.name,
      fields: {
        format: formatName(item.meta),
        width: size.width,
        height: size.height,
        size: item.meta.size ?? null,
        camera: [exif.make, exif.model].filter(Boolean).join(' ') || null,
        dateTaken: exif.dateTaken,
        location: exif.location || exif.hasGps ? 'Yes' : 'No',
        copyright: exif.copyright,
        artist: exif.artist,
        orientation: exif.orientation,
        colourProfile: metadata.icc ? 'Yes' : 'No',
        xmp: metadata.xmp ? 'Yes' : 'No',
      },
    })
    return [{ port: 'out', item }]
  },
})

export const compareNode = defineNode({
  type: 'compare',
  label: 'Compare',
  category: 'output',
  description: 'Shows a before and after slider and the size difference. Passes items through.',
  schema: z.object({}),
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: (_settings, input) => input,
  simulate: keepMeta,
  async run(input, _settings, context) {
    if (input.mode !== 'each') throw new Error('Compare runs per item.')
    const { meta } = input.item
    const saved =
      meta.size === undefined ? null : Math.round((1 - meta.size / meta.source.size) * 1000) / 10
    context.record({
      name: meta.name,
      fields: {
        sourceFormat: formatName(meta.source),
        format: formatName(meta),
        sourceSize: meta.source.size,
        size: meta.size ?? null,
        savedPercent: saved,
        sourceWidth: meta.source.width ?? null,
        sourceHeight: meta.source.height ?? null,
        width: meta.width ?? null,
        height: meta.height ?? null,
      },
    })
    return [{ port: 'out', item: input.item }]
  },
})

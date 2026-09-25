import { z } from 'zod'

import type { ImageFormat } from '#/features/engine/types'
import { asImage, dropWarning, withMetadata } from '#/features/images/image-item'
import { writeMetadata } from '#/features/images/metadata/containers'
import { parseExif } from '#/features/images/metadata/exif'
import { stripMetadata } from '#/features/images/metadata/strip'
import { ALL_IMAGE_TYPES, OUTPUT_PORT } from '#/features/nodes/constants'
import { defineNode } from '#/features/nodes/define-node'

export const stripMetadataNode = defineNode({
  type: 'strip-metadata',
  label: 'Strip metadata',
  category: 'metadata',
  description: 'Removes all metadata, only location data, or everything except copyright.',
  schema: z.object({
    mode: z.enum(['all', 'location', 'copyright']).default('all'),
    keepColourProfile: z.boolean().default(true),
  }),
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: (_settings, input) => input,
  simulate: (_settings, meta) => [{ port: 'out', meta }],
  cost: () => ({ ms: 2, encodes: 0, decodes: 0 }),
  async run(input, settings, context) {
    if (input.mode !== 'each') throw new Error('Strip metadata runs per item.')
    const item = asImage(input.item)
    const metadata = stripMetadata(item.payload.metadata, settings)
    const orientation = parseExif(metadata.exif).orientation
    const stripped = withMetadata(item, metadata, { orientation })
    const { encoded } = item.payload
    if (!encoded) return [{ port: 'out', item: stripped }]
    const format = item.meta.format as ImageFormat
    const written = await writeMetadata(format, encoded, metadata)
    if (written.dropped.length > 0) context.warn(dropWarning(format, written.dropped))
    return [
      {
        port: 'out',
        item: {
          meta: { ...stripped.meta, size: written.bytes.byteLength },
          payload: {
            ...stripped.payload,
            encoded: written.bytes,
            pixels: item.payload.pixels,
            metadataChanged: false,
          },
        },
      },
    ]
  },
})

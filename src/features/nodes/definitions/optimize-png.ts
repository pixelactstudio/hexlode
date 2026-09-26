import { z } from 'zod'

import { asImage, codecsOf, dropWarning, pixelsOf } from '#/features/images/image-item'
import { writeMetadata } from '#/features/images/metadata/containers'
import { isEmptyMetadata } from '#/features/images/metadata/strip'
import { OUTPUT_PORT, PNG_TYPES } from '#/features/nodes/constants'
import { encodeCost } from '#/features/nodes/cost'
import { defineNode } from '#/features/nodes/define-node'

export const optimizePngNode = defineNode({
  type: 'optimize-png',
  label: 'Optimize PNG',
  category: 'output',
  description: 'Makes PNG files smaller without changing pixels.',
  schema: z.object({
    level: z.number().int().min(0).max(6).default(2),
    interlace: z.boolean().default(false),
  }),
  ports: () => OUTPUT_PORT,
  accepts: () => PNG_TYPES,
  produces: () => PNG_TYPES,
  simulate: (_settings, meta) => [{ port: 'out', meta }],
  cost: (_settings, meta) => encodeCost(meta, 'png'),
  async run(input, settings, context) {
    if (input.mode !== 'each') throw new Error('Optimize PNG runs per item.')
    const item = asImage(input.item)
    const codecs = codecsOf(context)
    const options = { optimisationLevel: settings.level, interlace: settings.interlace }
    let bytes = item.payload.encoded
      ? await codecs.optimisePng(item.payload.encoded, options)
      : await codecs.encode({ format: 'png', options }, await pixelsOf(item, codecs))
    const { metadata } = item.payload
    if (!isEmptyMetadata(metadata)) {
      const written = await writeMetadata('png', bytes, metadata)
      if (written.dropped.length > 0) context.warn(dropWarning('png', written.dropped))
      bytes = written.bytes
    }
    if (
      item.payload.encoded &&
      !item.payload.metadataChanged &&
      bytes.length >= item.payload.encoded.length
    ) {
      return [{ port: 'out', item }]
    }
    return [
      {
        port: 'out',
        item: {
          meta: { ...item.meta, size: bytes.byteLength },
          payload: {
            encoded: bytes,
            pixels: item.payload.pixels,
            metadata,
            metadataChanged: false,
            encode: { format: 'png', options },
          },
        },
      },
    ]
  },
})

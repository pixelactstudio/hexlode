import { z } from 'zod'
import type { ImageFormat } from '#/features/engine/types'
import { asImage, codecsOf, fileBytesOf } from '#/features/images/image-item'
import { ALL_IMAGE_TYPES, OUTPUT_PORT } from '#/features/nodes/constants'
import { encodeCost } from '#/features/nodes/cost'
import { defineNode } from '#/features/nodes/define-node'

export const outputNode = defineNode({
  type: 'output',
  label: 'Output',
  category: 'output',
  description: 'Saves items, passes them on, and delivers a ZIP or folder.',
  cacheable: false,
  delivers: true,
  privateSettings: ['archiveName'],
  schema: z.object({
    destination: z.enum(['zip', 'folder']).default('zip'),
    autoDownload: z.boolean().default(false),
    archiveName: z.string().max(120).default('hexlode'),
  }),
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: (_settings, input) => input,
  simulate: (_settings, meta) => [{ port: 'out', meta }],
  cost: (_settings, meta, state) =>
    state.encoded
      ? { ms: 0, encodes: 0, needsPixels: false }
      : encodeCost(meta, meta.format as ImageFormat),
  async run(input, _settings, context) {
    if (input.mode !== 'each') throw new Error('Output runs per item.')
    const item = asImage(input.item)
    const bytes = await fileBytesOf(item, codecsOf(context), context.warn)
    const sink = context.services.output
    if (!sink) throw new Error('Output storage is not available.')
    await sink.write(context.nodeId, item.meta.name, bytes)
    if (item.payload.encoded === bytes) return [{ port: 'out', item }]
    // The same item, now in the encoded form Output saved.
    return [
      {
        port: 'out',
        item: {
          meta: { ...item.meta, size: bytes.byteLength },
          payload: { ...item.payload, encoded: bytes, metadataChanged: false },
        },
      },
    ]
  },
})

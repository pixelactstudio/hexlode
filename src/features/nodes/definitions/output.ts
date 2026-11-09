import { z } from 'zod'
import { union } from '#/features/engine/item-types'
import type { ImageFormat } from '#/features/engine/types'
import { fileBytes, isFileItem } from '#/features/file-items/file-item'
import { asImage, codecsOf, fileOf, keptFormat, keptTypes } from '#/features/images/image-item'
import { ALL_ITEM_TYPES, OUTPUT_PORT } from '#/features/nodes/constants'
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
  accepts: () => ALL_ITEM_TYPES,
  // A HEIC image whose pixels changed is saved, and passed on, as JPEG or PNG.
  produces: (_settings, input) => union([input, keptTypes(input)]),
  simulate: (_settings, meta) => [{ port: 'out', meta }],
  cost: (_settings, meta, state) =>
    state.encoded || meta.kind !== 'image'
      ? { ms: 0, encodes: 0, needsPixels: false }
      : encodeCost(meta, keptFormat(meta.format as ImageFormat)),
  async run(input, _settings, context) {
    if (input.mode !== 'each') throw new Error('Output runs per item.')
    const sink = context.services.output
    if (!sink) throw new Error('Output storage is not available.')
    if (isFileItem(input.item)) {
      await sink.write(context.nodeId, input.item.meta.name, fileBytes(input.item))
      return [{ port: 'out', item: input.item }]
    }
    // The same item, in the encoded form Output saved.
    const file = await fileOf(asImage(input.item), codecsOf(context), context.warn)
    await sink.write(context.nodeId, file.meta.name, file.payload.encoded as Uint8Array)
    return [{ port: 'out', item: file }]
  },
})

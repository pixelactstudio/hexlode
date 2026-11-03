import { z } from 'zod'

import type { ImageFormat } from '#/features/engine/types'
import { asImage, dropWarning, withMetadata } from '#/features/images/image-item'
import { writeMetadata } from '#/features/images/metadata/containers'
import { setExifText } from '#/features/images/metadata/exif'
import { ALL_IMAGE_TYPES, OUTPUT_PORT } from '#/features/nodes/constants'
import { defineNode } from '#/features/nodes/define-node'

const text = z.string().max(200).default('')

export const setCopyrightNode = defineNode({
  type: 'set-copyright',
  label: 'Set copyright / author',
  category: 'metadata',
  description: 'Writes author and copyright fields. Empty fields stay as they are.',
  privateSettings: ['artist', 'copyright'],
  schema: z.object({ artist: text, copyright: text }),
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: (_settings, input) => input,
  simulate: (_settings, meta) => [{ port: 'out', meta }],
  cost: () => ({ ms: 2, encodes: 0, needsPixels: false }),
  async run(input, settings, context) {
    if (input.mode !== 'each') throw new Error('Set copyright / author runs per item.')
    const item = asImage(input.item)
    const artist = settings.artist.trim() || undefined
    const copyright = settings.copyright.trim() || undefined
    if (!artist && !copyright) return [{ port: 'out', item }]
    const metadata = {
      ...item.payload.metadata,
      exif: setExifText(item.payload.metadata.exif, { artist, copyright }),
    }
    const changed = withMetadata(item, metadata)
    const { encoded } = item.payload
    if (!encoded) return [{ port: 'out', item: changed }]
    // Rewrite the container now, without re-encoding, like Strip metadata.
    const format = item.meta.format as ImageFormat
    const written = await writeMetadata(format, encoded, metadata)
    if (written.dropped.length > 0) context.warn(dropWarning(format, written.dropped))
    return [
      {
        port: 'out',
        item: {
          meta: { ...changed.meta, size: written.bytes.byteLength },
          payload: { ...changed.payload, encoded: written.bytes, metadataChanged: false },
        },
      },
    ]
  },
})

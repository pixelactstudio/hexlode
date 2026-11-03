import { z } from 'zod'
import type { Port } from '#/features/engine/types'
import { differenceHash, exactHash, hashDistance } from '#/features/images/fingerprint'
import { asImage, codecsOf, pixelsOf } from '#/features/images/image-item'
import { ALL_IMAGE_TYPES } from '#/features/nodes/constants'
import { PIXEL_OP_MS_PER_MEGAPIXEL, pixelCost } from '#/features/nodes/cost'
import { defineNode } from '#/features/nodes/define-node'

const DUPLICATES_PORT = 'duplicates'

const PORTS: Port[] = [
  { id: 'out', label: 'Unique' },
  { id: DUPLICATES_PORT, label: 'Duplicates' },
]

const schema = z.object({
  /** Exact compares every pixel; near compares fingerprints that survive re-encoding. */
  mode: z.enum(['exact', 'near']).default('near'),
  /**
   * Near duplicates: the share of fingerprint bits that may differ, in percent. Resaved and
   * resized copies differ by under 5%, different photos of similar scenes by over 12%.
   */
  difference: z.number().min(0).max(30).default(8),
  /** Which image of a group stays: the first to arrive or the one with the most pixels. */
  keep: z.enum(['first', 'largest']).default('first'),
})

interface Group {
  fingerprint: string | Uint32Array
  kept: number
  pixels: number
  name: string
}

export const deduplicateNode = defineNode({
  type: 'deduplicate',
  label: 'Deduplicate',
  category: 'input',
  description: 'Drops exact duplicates, or near duplicates by image fingerprint.',
  mode: 'all',
  schema,
  ports: () => PORTS,
  accepts: () => ALL_IMAGE_TYPES,
  produces: (_settings, input) => input,
  // For estimates: every item counts as unique and leaves by Unique, unchanged.
  simulate: (_settings, meta) => [{ port: 'out', meta }],
  cost: (_settings, meta) => pixelCost(meta, PIXEL_OP_MS_PER_MEGAPIXEL),
  async run(input, settings, context) {
    if (input.mode !== 'all') throw new Error('Deduplicate waits for every item.')
    const codecs = codecsOf(context)
    const groups: Group[] = []
    const groupOf: number[] = []
    const names: string[] = []
    let index = 0
    for await (const entry of input.items) {
      const item = asImage(entry)
      const pixels = await pixelsOf(item, codecs)
      const fingerprint =
        settings.mode === 'exact' ? exactHash(pixels) : await differenceHash(pixels, codecs)
      const area = pixels.width * pixels.height
      const limit = settings.difference / 100
      const match = groups.findIndex((group) =>
        typeof fingerprint === 'string'
          ? group.fingerprint === fingerprint
          : hashDistance(group.fingerprint as Uint32Array, fingerprint) <= limit,
      )
      names.push(item.meta.name)
      if (match === -1) {
        groups.push({ fingerprint, kept: index, pixels: area, name: item.meta.name })
        groupOf.push(groups.length - 1)
      } else {
        groupOf.push(match)
        const group = groups[match]
        if (settings.keep === 'largest' && area > group.pixels) {
          group.kept = index
          group.pixels = area
          group.name = item.meta.name
        }
      }
      index += 1
    }
    return groupOf.map((group, position) => {
      const kept = groups[group].kept === position
      if (!kept) {
        context.record({ name: names[position], fields: { duplicateOf: groups[group].name } })
      }
      return { port: kept ? 'out' : DUPLICATES_PORT, input: position }
    })
  },
})

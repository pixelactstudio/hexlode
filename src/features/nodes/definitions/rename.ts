import { z } from 'zod'
import type { ImageFormat, ItemMeta } from '#/features/engine/types'
import { IMAGE_EXTENSIONS } from '#/features/image-input/validators'
import { displaySize } from '#/features/images/pixel-ops'
import { ALL_IMAGE_TYPES, OUTPUT_PORT } from '#/features/nodes/constants'
import { defineNode } from '#/features/nodes/define-node'

export const RENAME_TOKENS = ['{name}', '{width}', '{height}', '{format}'] as const

const schema = z.object({
  template: z.string().max(200).default('{name}'),
  lowercase: z.boolean().default(false),
  replaceSpaces: z.boolean().default(false),
})

/** Renders the new name. The extension always follows the item's format. */
export function renderName(meta: ItemMeta, settings: z.infer<typeof schema>) {
  const slash = meta.name.lastIndexOf('/')
  const folder = slash >= 0 ? meta.name.slice(0, slash + 1) : ''
  const leaf = meta.name.slice(slash + 1)
  const dot = leaf.lastIndexOf('.')
  const stem = dot > 0 ? leaf.slice(0, dot) : leaf
  const size = displaySize(meta)
  let rendered = settings.template
    .replaceAll('{name}', stem)
    .replaceAll('{width}', String(size.width))
    .replaceAll('{height}', String(size.height))
    .replaceAll('{format}', meta.format)
    .replaceAll(/[/\\?%*:|"<>]/g, '-')
    .trim()
  if (settings.replaceSpaces) rendered = rendered.replaceAll(/\s+/g, '-')
  if (settings.lowercase) rendered = rendered.toLocaleLowerCase()
  const extension = IMAGE_EXTENSIONS[meta.format as ImageFormat] ?? meta.format
  return `${folder}${rendered || stem}.${extension}`
}

export const renameNode = defineNode({
  type: 'rename',
  label: 'Rename',
  category: 'output',
  description:
    'Names files from a template such as {name}-{width}w. Output numbers duplicate names.',
  schema,
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: (_settings, input) => input,
  simulate: (settings, meta) => [
    { port: 'out', meta: { ...meta, name: renderName(meta, settings) } },
  ],
  async run(input, settings) {
    if (input.mode !== 'each') throw new Error('Rename runs per item.')
    const { item } = input
    return [
      {
        port: 'out',
        item: {
          meta: { ...item.meta, name: renderName(item.meta, settings) },
          payload: item.payload,
        },
      },
    ]
  },
})

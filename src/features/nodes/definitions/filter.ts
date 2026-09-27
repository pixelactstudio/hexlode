import { z } from 'zod'

import { FORMAT_LABELS, IMAGE_FORMATS, intersect, typesOf } from '#/features/engine/item-types'
import type { ImageFormat, ItemMeta, ItemType, ItemTypeSet, Port } from '#/features/engine/types'
import { asImage, codecsOf, pixelsOf } from '#/features/images/image-item'
import { displaySize, hasTransparency } from '#/features/images/pixel-ops'
import { ALL_IMAGE_TYPES } from '#/features/nodes/constants'
import { defineNode } from '#/features/nodes/define-node'

const id = z.string().min(1).max(40)
const compare = z.enum(['less', 'more'])

export const filterRuleSchema = z.discriminatedUnion('field', [
  z.object({
    id,
    field: z.literal('format'),
    operator: z.enum(['is', 'isNot']).default('is'),
    formats: z.array(z.enum(IMAGE_FORMATS)).min(1).default(['png']),
  }),
  z.object({
    id,
    field: z.literal('fileSize'),
    operator: compare.default('more'),
    kilobytes: z.number().min(0).default(500),
  }),
  z.object({
    id,
    field: z.enum(['width', 'height', 'longestEdge']),
    operator: compare.default('more'),
    pixels: z.number().int().min(0).default(2000),
  }),
  z.object({
    id,
    field: z.literal('orientation'),
    operator: z.literal('is').default('is'),
    orientation: z.enum(['landscape', 'portrait', 'square']).default('landscape'),
  }),
  z.object({
    id,
    field: z.literal('transparency'),
    operator: z.enum(['has', 'hasNot']).default('has'),
  }),
])

export type FilterRule = z.infer<typeof filterRuleSchema>

export const ELSE_PORT = 'else'

const schema = z.object({
  rules: z
    .array(filterRuleSchema)
    .max(12)
    .default([{ id: 'rule-1', field: 'format', operator: 'is', formats: ['png'] }]),
})

const FIELD_LABELS = {
  fileSize: 'File size',
  width: 'Width',
  height: 'Height',
  longestEdge: 'Longest edge',
}

export function describeRule(rule: FilterRule) {
  switch (rule.field) {
    case 'format': {
      const names = rule.formats.map((format) => FORMAT_LABELS[format]).join(', ')
      return rule.operator === 'is' ? names : `Not ${names}`
    }
    case 'fileSize':
      return `${FIELD_LABELS.fileSize} ${rule.operator === 'less' ? '<' : '>'} ${rule.kilobytes} KB`
    case 'width':
    case 'height':
    case 'longestEdge':
      return `${FIELD_LABELS[rule.field]} ${rule.operator === 'less' ? '<' : '>'} ${rule.pixels} px`
    case 'orientation':
      return rule.orientation.charAt(0).toUpperCase() + rule.orientation.slice(1)
    case 'transparency':
      return rule.operator === 'has' ? 'Has transparency' : 'No transparency'
  }
}

/** Item types a rule matches whatever the pixels are, or undefined when it depends on content. */
function alwaysMatched(rule: FilterRule, available: ItemTypeSet): ItemTypeSet {
  if (rule.field !== 'format') return new Set()
  const formats = typesOf('image', rule.formats)
  if (rule.operator === 'is') return intersect(available, formats)
  return new Set([...available].filter((type) => !formats.has(type)))
}

function withoutTypes(set: ItemTypeSet, removed: ItemTypeSet) {
  return new Set<ItemType>([...set].filter((type) => !removed.has(type)))
}

function matchesFromMeta(rule: FilterRule, meta: ItemMeta): boolean | null {
  const size = displaySize(meta)
  const compareTo = (value: number, limit: number) =>
    rule.operator === 'less' ? value < limit : value > limit
  switch (rule.field) {
    case 'format': {
      const listed = rule.formats.includes(meta.format as ImageFormat)
      return rule.operator === 'is' ? listed : !listed
    }
    case 'fileSize':
      return meta.size === undefined ? null : compareTo(meta.size / 1024, rule.kilobytes)
    case 'width':
      return compareTo(size.width, rule.pixels)
    case 'height':
      return compareTo(size.height, rule.pixels)
    case 'longestEdge':
      return compareTo(Math.max(size.width, size.height), rule.pixels)
    case 'orientation': {
      const shape =
        size.width === size.height ? 'square' : size.width > size.height ? 'landscape' : 'portrait'
      return shape === rule.orientation
    }
    case 'transparency':
      return null
  }
}

export const filterNode = defineNode({
  type: 'filter',
  label: 'Filter',
  category: 'input',
  description:
    'Routes items by rules on format, file size, dimensions, orientation or transparency. Each rule has its own output, plus an output for everything else.',
  schema,
  ports: (settings): Port[] => [
    ...settings.rules.map((rule) => ({ id: rule.id, label: describeRule(rule) })),
    { id: ELSE_PORT, label: 'Everything else' },
  ],
  accepts: () => ALL_IMAGE_TYPES,
  produces: (settings, input, port) => {
    let available = input
    for (const rule of settings.rules) {
      const always = alwaysMatched(rule, available)
      if (rule.id === port) {
        if (rule.field === 'format') return always
        return available
      }
      available = withoutTypes(available, always)
    }
    return available
  },
  simulate: (settings, meta) => {
    for (const rule of settings.rules) {
      const matches = matchesFromMeta(rule, meta)
      if (matches === null) return null
      if (matches) return [{ port: rule.id, meta }]
    }
    return [{ port: ELSE_PORT, meta }]
  },
  cost: (settings) => ({
    ms: 0,
    encodes: 0,
    needsPixels: settings.rules.some((rule) => rule.field === 'transparency'),
  }),
  async run(input, settings, context) {
    if (input.mode !== 'each') throw new Error('Filter runs per item.')
    const item = asImage(input.item)
    for (const rule of settings.rules) {
      let matches = matchesFromMeta(rule, item.meta)
      if (matches === null && rule.field === 'transparency') {
        const transparent = hasTransparency(await pixelsOf(item, codecsOf(context)))
        matches = rule.operator === 'has' ? transparent : !transparent
      }
      if (matches) return [{ port: rule.id, item }]
    }
    return [{ port: ELSE_PORT, item }]
  },
})

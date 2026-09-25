/**
 * Test-only nodes with data and document items, one-to-many and many-to-one behaviour. They take
 * part in the node pair matrix so kind rules are checked, but they are not in the product.
 */
import { z } from 'zod'

import type { AnyNodeDefinition, ItemType } from '#/features/engine/types'
import { ALL_IMAGE_TYPES, OUTPUT_PORT } from '#/features/nodes/constants'
import { defineNode } from '#/features/nodes/define-node'

const JSON_TYPES = new Set<ItemType>(['data:json'])
const PDF_TYPES = new Set<ItemType>(['document:pdf'])

export const describeNode = defineNode({
  type: 'test.describe',
  label: 'Describe (test)',
  category: 'output',
  description: 'Turns each image into two JSON items.',
  schema: z.object({}),
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: () => JSON_TYPES,
  async run(input) {
    if (input.mode !== 'each') throw new Error('each')
    const { meta } = input.item
    return ['size', 'format'].map((field) => {
      const bytes = new TextEncoder().encode(JSON.stringify({ [field]: meta[field as 'size'] }))
      return {
        port: 'out',
        item: {
          meta: {
            ...meta,
            kind: 'data' as const,
            format: 'json' as const,
            name: `${meta.name}.${field}.json`,
            size: bytes.length,
          },
          payload: { bytes },
        },
      }
    })
  },
})

export const bundleNode = defineNode({
  type: 'test.bundle',
  label: 'Bundle (test)',
  category: 'output',
  description: 'Waits for every image and makes one document.',
  mode: 'all',
  schema: z.object({}),
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: () => PDF_TYPES,
  async run(input) {
    if (input.mode !== 'all') throw new Error('all')
    let count = 0
    for await (const _item of input.items) count += 1
    const bytes = new TextEncoder().encode(`%PDF-1.7 ${count}`)
    return [
      {
        port: 'out',
        item: {
          meta: {
            kind: 'document',
            format: 'pdf',
            name: 'bundle.pdf',
            size: bytes.length,
            source: { size: 0, format: 'pdf' },
          },
          payload: { bytes },
        },
      },
    ]
  },
})

const reader = (type: string, label: string, accepts: Set<ItemType>) =>
  defineNode({
    type,
    label,
    category: 'output',
    description: 'Passes items on.',
    schema: z.object({}),
    ports: () => OUTPUT_PORT,
    accepts: () => accepts,
    produces: (_settings, input) => input,
    async run(input) {
      if (input.mode !== 'each') throw new Error('each')
      return [{ port: 'out', item: input.item }]
    },
  })

export const readDataNode = reader('test.read-data', 'Read data (test)', JSON_TYPES)
export const readDocumentNode = reader('test.read-document', 'Read document (test)', PDF_TYPES)

export const TEST_ONLY_NODES = [
  describeNode,
  bundleNode,
  readDataNode,
  readDocumentNode,
] as unknown as AnyNodeDefinition[]

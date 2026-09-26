/**
 * Test-only node types. They prove engine behaviour that later node batches need (data and
 * document items, one item to many, many items to one) without adding those nodes to the product.
 */
import type {
  AnyNodeDefinition,
  Item,
  ItemMeta,
  ItemType,
  ItemTypeSet,
  NodeRegistry,
} from '#/features/engine/types'

export const IMAGE_TYPES: ItemTypeSet = new Set<ItemType>([
  'image:jpeg',
  'image:png',
  'image:webp',
  'image:avif',
  'image:jxl',
  'image:qoi',
])

export interface TestPayload {
  bytes: Uint8Array
}

export function testItem(name: string, format = 'png', bytes = [1, 2, 3]): Item<TestPayload> {
  const data = Uint8Array.from(bytes)
  return {
    meta: {
      kind: 'image',
      format: format as ItemMeta['format'],
      name,
      size: data.byteLength,
      source: { size: data.byteLength, format: format as ItemMeta['format'] },
    },
    payload: { bytes: data },
  }
}

interface TestNodeOptions {
  type: string
  label?: string
  accepts?: ItemTypeSet
  produces?: (input: ItemTypeSet, port: string) => ItemTypeSet
  ports?: string[]
  mode?: 'each' | 'all'
  cacheable?: boolean
  hasInput?: boolean
  run?: AnyNodeDefinition['run']
}

export function defineTestNode(options: TestNodeOptions): AnyNodeDefinition {
  const ports = options.ports ?? ['out']
  return {
    type: options.type,
    version: 1,
    label: options.label ?? options.type,
    category: 'size',
    description: 'Test node',
    hasInput: options.hasInput ?? true,
    mode: options.mode ?? 'each',
    cacheable: options.cacheable ?? true,
    defaults: {},
    parseSettings: (value) => ({ ...(value as Record<string, unknown>) }),
    ports: () => ports.map((id) => ({ id, label: id })),
    accepts: () => options.accepts ?? IMAGE_TYPES,
    produces: (_settings, input, port) => options.produces?.(input, port) ?? input,
    run:
      options.run ??
      (async (input) => {
        if (input.mode !== 'each') throw new Error('each only')
        return [{ port: ports[0], item: input.item }]
      }),
  }
}

export function createTestRegistry(nodes: AnyNodeDefinition[]): NodeRegistry {
  const byType = new Map(nodes.map((node) => [node.type, node]))
  return { get: (type) => byType.get(type), list: () => [...byType.values()] }
}

export const sourceNode = defineTestNode({
  type: 'source',
  label: 'Files',
  hasInput: false,
  produces: () => IMAGE_TYPES,
})

export const pngOnlyNode = defineTestNode({
  type: 'png-only',
  label: 'Optimize PNG',
  accepts: new Set<ItemType>(['image:png']),
})

export const toWebpNode = defineTestNode({
  type: 'to-webp',
  label: 'Convert',
  produces: () => new Set<ItemType>(['image:webp']),
})

export const dataOnlyNode = defineTestNode({
  type: 'data-only',
  label: 'Summarise data',
  accepts: new Set<ItemType>(['data:json', 'data:text']),
})

export function pipelineOf(
  nodes: [id: string, type: string, settings?: Record<string, unknown>][],
  connections: [source: string, target: string, sourcePort?: string][],
) {
  return {
    nodes: nodes.map(([id, type, settings]) => ({
      id,
      type,
      settings: settings ?? {},
      position: { x: 0, y: 0 },
    })),
    connections: connections.map(([source, target, sourcePort]) => ({
      id: `${source}-${sourcePort ?? 'out'}-${target}`,
      source,
      sourcePort: sourcePort ?? 'out',
      target,
    })),
  }
}

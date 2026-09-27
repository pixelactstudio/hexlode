import type { Delivery, Item, OutputSink } from '#/features/engine/types'

/** Holds items waiting at a node that combines items, until every upstream item has arrived. */
export interface SpillStore {
  put(nodeId: string, order: number[], key: string, item: Item): Promise<void>
  /** Spilled entries for a node, in pipeline order (source index, then output index). */
  list(nodeId: string): Promise<{ key: string; order: number[] }[]>
  load(nodeId: string, key: string): Promise<Item>
}

/** Saves items reaching Output nodes and turns them into a delivery. */
export interface OutputStore extends OutputSink {
  deliver(nodeId: string): Promise<Delivery>
}

export function compareOrder(a: number[], b: number[]) {
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? -1) - (b[index] ?? -1)
    if (difference !== 0) return difference
  }
  return 0
}

export function createMemorySpillStore(): SpillStore {
  const spilled = new Map<string, Map<string, { order: number[]; item: Item }>>()
  return {
    async put(nodeId, order, key, item) {
      const entries = spilled.get(nodeId) ?? new Map()
      entries.set(key, { order, item })
      spilled.set(nodeId, entries)
    },
    async list(nodeId) {
      return [...(spilled.get(nodeId)?.entries() ?? [])]
        .map(([key, { order }]) => ({ key, order }))
        .sort((a, b) => compareOrder(a.order, b.order))
    },
    async load(nodeId, key) {
      const entry = spilled.get(nodeId)?.get(key)
      if (!entry) throw new Error('The waiting item is missing.')
      return entry.item
    },
  }
}

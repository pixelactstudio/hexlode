/**
 * Aggregates engine events into the numbers the interface shows: per node, per connection and per
 * source file. Plain TypeScript; components subscribe and read snapshots.
 */
import type { Delivery, ItemFormat, NodeRecord, RunEvent, RunStatus } from '#/features/engine/types'
import { MAX_MESSAGES_PER_SOURCE, MAX_RECORDS_PER_NODE } from '#/features/runs/constants'

export interface NodeStats {
  processed: number
  cached: number
  skipped: number
  failed: number
  bytesIn: number
  bytesOut: number
  ms: number
  warnings: number
}

export interface ConnectionStats {
  items: number
  formats: ItemFormat[]
  bytes: number
  sourceBytes: number
}

export interface SourceRow {
  /** Pending until the item reaches Output, fails, or finishes without reaching Output. */
  status: 'pending' | 'done' | 'skipped' | 'failed'
  outputBytes?: number
  error?: string
  warnings: string[]
}

export interface RunSnapshot {
  status: 'idle' | 'running' | RunStatus
  itemCount: number
  finishedItems: number
  ms: number
  nodes: Record<string, NodeStats>
  connections: Record<string, ConnectionStats>
  sources: Record<number, SourceRow>
  records: Record<string, (NodeRecord & { source?: number })[]>
  deliveries: Record<string, Delivery>
  warningCodes: string[]
  failureMessages: string[]
}

const emptyNode = (): NodeStats => ({
  processed: 0,
  cached: 0,
  skipped: 0,
  failed: 0,
  bytesIn: 0,
  bytesOut: 0,
  ms: 0,
  warnings: 0,
})

function emptySnapshot(): RunSnapshot {
  return {
    status: 'idle',
    itemCount: 0,
    finishedItems: 0,
    ms: 0,
    nodes: {},
    connections: {},
    sources: {},
    records: {},
    deliveries: {},
    warningCodes: [],
    failureMessages: [],
  }
}

export function createRunStats(options: { outputNodeId?: string } = {}) {
  let state = emptySnapshot()
  let published: RunSnapshot = state
  let dirty = false
  const listeners = new Set<() => void>()

  const node = (id: string) => {
    state.nodes[id] ??= emptyNode()
    return state.nodes[id]
  }
  const source = (index: number) => {
    state.sources[index] ??= { status: 'pending', warnings: [] }
    return state.sources[index]
  }

  const apply = (event: RunEvent) => {
    switch (event.type) {
      case 'run-started':
        state = { ...emptySnapshot(), status: 'running', itemCount: event.itemCount }
        break
      case 'node-item': {
        const stats = node(event.nodeId)
        stats.ms += event.ms
        if (event.recomputed) break
        stats[event.status] += 1
        stats.bytesIn += event.bytesIn ?? 0
        stats.bytesOut += event.bytesOut ?? 0
        if (event.source === undefined) break
        if (event.status === 'failed') {
          const row = source(event.source)
          row.status = 'failed'
          row.error ??= event.error
          if (state.failureMessages.length < 50 && event.error) {
            state.failureMessages.push(event.error)
          }
        }
        if (event.nodeId === options.outputNodeId) {
          const row = source(event.source)
          if (event.status === 'skipped' && row.status !== 'failed') row.status = 'skipped'
          if (event.status === 'processed' || event.status === 'cached') {
            row.outputBytes = (row.outputBytes ?? 0) + (event.bytesOut ?? 0)
            if (row.status !== 'failed') row.status = 'done'
          }
        }
        break
      }
      case 'connection-item': {
        state.connections[event.connectionId] ??= {
          items: 0,
          formats: [],
          bytes: 0,
          sourceBytes: 0,
        }
        const stats = state.connections[event.connectionId]
        stats.items += 1
        if (!stats.formats.includes(event.format)) stats.formats.push(event.format)
        if (event.bytes !== undefined) {
          stats.bytes += event.bytes
          stats.sourceBytes += event.sourceBytes ?? 0
        }
        break
      }
      case 'node-record': {
        state.records[event.nodeId] ??= []
        const list = state.records[event.nodeId]
        if (list.length < MAX_RECORDS_PER_NODE) list.push({ ...event.record, source: event.source })
        break
      }
      case 'node-warning': {
        node(event.nodeId).warnings += 1
        if (!state.warningCodes.includes(event.warning.code)) {
          state.warningCodes.push(event.warning.code)
        }
        if (event.source !== undefined) {
          const row = source(event.source)
          if (row.warnings.length < MAX_MESSAGES_PER_SOURCE)
            row.warnings.push(event.warning.message)
        }
        break
      }
      case 'item-finished': {
        state.finishedItems += 1
        const row = source(event.index)
        if (row.status === 'pending') row.status = 'skipped'
        break
      }
      case 'delivery-ready':
        state.deliveries[event.nodeId] = event.delivery
        break
      case 'run-finished':
        state.status = event.status
        state.ms = event.ms
        break
    }
    dirty = true
    for (const listener of listeners) listener()
  }

  return {
    apply,
    reset() {
      state = emptySnapshot()
      dirty = true
      for (const listener of listeners) listener()
    },
    /** A structurally new object after each change, so React can compare by reference. */
    snapshot(): RunSnapshot {
      if (dirty) {
        published = structuredClone(state)
        dirty = false
      }
      return published
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export type RunStats = ReturnType<typeof createRunStats>

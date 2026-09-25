/**
 * Engine contracts. The engine is plain TypeScript: no React, no DOM rendering.
 */

export type ItemKind = 'image' | 'data' | 'document'

export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'jxl' | 'qoi'
export type DataFormat = 'json' | 'text'
export type DocumentFormat = 'pdf'
export type ItemFormat = ImageFormat | DataFormat | DocumentFormat

/** `kind:format`, for example `image:png`. The unit of accepts and produces. */
export type ItemType = `${ItemKind}:${string}`

/** The set of item types that can travel along a connection or that a node accepts. */
export type ItemTypeSet = ReadonlySet<ItemType>

/** Small, serialisable facts about an item. Used for skips, routing, stats and estimates. */
export interface ItemMeta {
  kind: ItemKind
  format: ItemFormat
  /** Relative path including the extension, for example `trip/beach.jpg`. */
  name: string
  /** Encoded size in bytes, when the item has an encoded form. */
  size?: number
  width?: number
  height?: number
  /** Camera orientation tag (1 to 8) for images. 5 to 8 display rotated a quarter turn. */
  orientation?: number
  /** The file the item came from. Used by Compare. */
  source: { size: number; format: ItemFormat; width?: number; height?: number }
}

/** One unit flowing through a pipeline. The payload is kind specific and opaque to the engine. */
export interface Item<P = unknown> {
  meta: ItemMeta
  payload: P
}

export interface PipelineNode {
  id: string
  type: string
  settings: Record<string, unknown>
  position: { x: number; y: number }
}

export interface Connection {
  id: string
  source: string
  sourcePort: string
  target: string
}

export interface Pipeline {
  nodes: PipelineNode[]
  connections: Connection[]
}

export type NodeCategory = 'input' | 'size' | 'colour' | 'overlay' | 'metadata' | 'output'

export interface Port {
  id: string
  label: string
}

export interface NodeOutput<P = unknown> {
  port: string
  item: Item<P>
}

export interface NodeWarning {
  code: string
  message: string
}

/** A record a node reports about an item, shown in the Studio (Inspect, Compare). */
export interface NodeRecord {
  name: string
  fields: Record<string, string | number | boolean | null>
}

export interface OutputSink {
  /** Saves the final bytes of an item for delivery. */
  write(nodeId: string, name: string, bytes: Uint8Array): Promise<void>
}

export interface NodeContext {
  nodeId: string
  signal: AbortSignal
  services: EngineServices
  warn(warning: NodeWarning): void
  record(record: NodeRecord): void
}

/** Heavy dependencies a node may use. Injected so tests and workers choose adapters. */
export interface EngineServices {
  codecs?: unknown
  output?: OutputSink
}

export type NodeMode = 'each' | 'all'

export interface NodeDefinition<S extends Record<string, unknown> = Record<string, unknown>> {
  type: string
  /** Bump when output for the same settings changes, so step caches are invalidated. */
  version: number
  label: string
  category: NodeCategory
  description: string
  /** Nodes without an input start a pipeline (Files). */
  hasInput: boolean
  /** `each` runs once per item. `all` waits for every upstream item and runs once. */
  mode: NodeMode
  /** Output nodes and other nodes with side effects are never served from the step cache. */
  cacheable: boolean
  defaults: S
  parseSettings(value: unknown): S
  ports(settings: S): Port[]
  accepts(settings: S): ItemTypeSet
  /** What leaves each port, given what enters the node (already narrowed to accepts). */
  produces(settings: S, input: ItemTypeSet, port: string): ItemTypeSet
  /** Predicts outputs from meta alone, for estimates. Returns null when the route needs pixels. */
  simulate?(settings: S, meta: ItemMeta): { port: string; meta: ItemMeta }[] | null
  /** Rough cost of processing one item, in milliseconds on one core. */
  cost?(settings: S, meta: ItemMeta): { ms: number; encodes: number; decodes: number }
  /** Output nodes deliver the items they saved once no more items can arrive. */
  delivers?: boolean
  run(input: NodeInput, settings: S, context: NodeContext): Promise<NodeOutput[]>
}

export type NodeInput =
  | { mode: 'each'; item: Item }
  | { mode: 'all'; items: AsyncIterable<Item>; count: number }

export type AnyNodeDefinition = NodeDefinition<Record<string, unknown>>

export interface NodeRegistry {
  get(type: string): AnyNodeDefinition | undefined
  list(): AnyNodeDefinition[]
}

/** Per-kind rules the engine needs to store and measure items without knowing their payloads. */
export interface ItemKindHandler {
  /** Returns the payload to store, dropping anything that can be rebuilt (decoded pixels). */
  storable(payload: unknown): unknown
  /** Bytes the item holds in memory. Drives the worker pool size. */
  memoryBytes(item: Item): number
}

export type ItemStatus = 'processed' | 'cached' | 'skipped' | 'failed'

export type RunEvent =
  | { type: 'run-started'; runId: string; itemCount: number }
  | {
      type: 'node-item'
      nodeId: string
      status: ItemStatus
      bytesIn?: number
      bytesOut?: number
      ms: number
      error?: string
      /** The node ran again to rebuild a result deleted from the step cache. */
      recomputed?: boolean
    }
  | {
      type: 'connection-item'
      connectionId: string
      format: ItemFormat
      bytes?: number
      sourceBytes?: number
    }
  | { type: 'node-record'; nodeId: string; record: NodeRecord }
  | { type: 'node-warning'; nodeId: string; warning: NodeWarning }
  | { type: 'item-finished'; index: number }
  | { type: 'delivery-ready'; nodeId: string; delivery: Delivery }
  | { type: 'run-finished'; runId: string; status: RunStatus; ms: number }

export type RunStatus = 'complete' | 'cancelled' | 'failed'

export interface DeliveryFile {
  name: string
  size: number
}

export interface Delivery {
  nodeId: string
  files: DeliveryFile[]
  bytes: number
  /** The ZIP, backed by storage. Absent when the output store only lists files. */
  archive?: Blob
}

/**
 * Moves items through a pipeline. One call handles one source item (or one combining node) and
 * carries it depth first through every branch, so pixels stay in the thread that decoded them.
 * Runs inline in tests and inside workers in the app.
 */
import { settingsOf, topologicalOrder } from '#/features/engine/compatibility'
import { itemType } from '#/features/engine/item-types'
import { entryKey, nodeKey, outputKey } from '#/features/engine/keys'
import type { StepCache, StepCacheEntry } from '#/features/engine/step-cache'
import type { SpillStore } from '#/features/engine/stores'
import type {
  AnyNodeDefinition,
  Connection,
  EngineServices,
  Item,
  ItemKind,
  ItemKindHandler,
  ItemMeta,
  ItemTypeSet,
  NodeContext,
  NodeInput,
  NodeOutput,
  NodeRegistry,
  Pipeline,
  PipelineNode,
  RunEvent,
} from '#/features/engine/types'

export interface SourceItem {
  index: number
  /** Identifies the source file across runs. Part of every step cache key. */
  key: string
  meta: ItemMeta
  /** The file itself, for hosts that read it in a worker. */
  file?: Blob
  /** Builds the item, for hosts that run inline. */
  load?: () => Promise<Item>
}

interface PlannedNode {
  node: PipelineNode
  definition: AnyNodeDefinition
  settings: Record<string, unknown>
  key: string
  accepts: ItemTypeSet
  outgoing: Map<string, Connection[]>
}

export interface FlowPlan {
  nodes: Map<string, PlannedNode>
  order: string[]
  filesId: string
  /** Combining nodes, in pipeline order. */
  combining: string[]
  /** For each delivering node, the combining nodes that must finish before it can deliver. */
  deliveries: Map<string, string[]>
}

export type KindHandlers = Partial<Record<ItemKind, ItemKindHandler>>

export interface FlowDeps {
  plan: FlowPlan
  services: EngineServices
  spill: SpillStore
  cache?: StepCache
  kinds?: KindHandlers
  signal: AbortSignal
  emit(event: RunEvent): void
  /** Sees every item a node produces. Live previews use it to render thumbnails. */
  observe?(nodeId: string, port: string, item: Item, status: 'processed' | 'cached'): Promise<void>
}

interface ItemRef {
  key: string
  meta: ItemMeta
  order: number[]
  get(): Promise<Item>
  release(): void
}

const COMBINING_ORDER = 1e15

function ancestors(pipeline: Pipeline, nodeId: string) {
  const found = new Set<string>()
  const pending = [nodeId]
  while (pending.length > 0) {
    const id = pending.pop() as string
    for (const connection of pipeline.connections) {
      if (connection.target !== id || found.has(connection.source)) continue
      found.add(connection.source)
      pending.push(connection.source)
    }
  }
  return found
}

export function createFlowPlan(pipeline: Pipeline, registry: NodeRegistry): FlowPlan {
  const order = topologicalOrder(pipeline)
  const nodes = new Map<string, PlannedNode>()
  for (const node of pipeline.nodes) {
    const definition = registry.get(node.type)
    if (!definition) throw new Error(`Unknown node type: ${node.type}`)
    const settings = settingsOf(definition, node)
    const outgoing = new Map<string, Connection[]>()
    for (const connection of pipeline.connections) {
      if (connection.source !== node.id) continue
      outgoing.set(connection.sourcePort, [
        ...(outgoing.get(connection.sourcePort) ?? []),
        connection,
      ])
    }
    nodes.set(node.id, {
      node,
      definition,
      settings,
      key: nodeKey(definition.type, definition.version, settings),
      accepts: definition.hasInput ? definition.accepts(settings) : new Set(),
      outgoing,
    })
  }
  const starts = pipeline.nodes.filter((node) => !nodes.get(node.id)?.definition.hasInput)
  if (starts.length !== 1) throw new Error('A pipeline needs exactly one Files node.')
  const combining = order.filter((id) => nodes.get(id)?.definition.mode === 'all')
  const deliveries = new Map<string, string[]>()
  for (const id of order) {
    if (!nodes.get(id)?.definition.delivers) continue
    const before = ancestors(pipeline, id)
    deliveries.set(
      id,
      combining.filter((id) => before.has(id)),
    )
  }
  return { nodes, order, filesId: starts[0].id, combining, deliveries }
}

function createRef(
  key: string,
  meta: ItemMeta,
  order: number[],
  produce: () => Promise<Item>,
): ItemRef {
  let pending: Promise<Item> | undefined
  return {
    key,
    meta,
    order,
    get: () => {
      pending ??= produce()
      return pending
    },
    release: () => {
      pending = undefined
    },
  }
}

function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : 'The item could not be processed.'
}

function sumSizes(outputs: NodeOutput[]) {
  let total = 0
  for (const output of outputs) {
    if (output.item.meta.size === undefined) return undefined
    total += output.item.meta.size
  }
  return total
}

function contextFor(deps: FlowDeps, nodeId: string, source: number | undefined): NodeContext {
  return {
    nodeId,
    signal: deps.signal,
    services: deps.services,
    warn: (warning) => deps.emit({ type: 'node-warning', nodeId, source, warning }),
    record: (record) => deps.emit({ type: 'node-record', nodeId, source, record }),
  }
}

/** The source index of an item, from its order. Items after combining nodes have none. */
function sourceOf(order: number[]) {
  return order[0] !== undefined && order[0] < COMBINING_ORDER ? order[0] : undefined
}

async function runNode(
  deps: FlowDeps,
  planned: PlannedNode,
  input: NodeInput,
  entry: string,
  bytesIn: number | undefined,
  reusable: unknown,
  recomputed: boolean,
  source: number | undefined,
) {
  const started = performance.now()
  const nodeId = planned.node.id
  let outputs: NodeOutput[]
  try {
    outputs = await planned.definition.run(
      input,
      planned.settings,
      contextFor(deps, nodeId, source),
    )
  } catch (reason) {
    deps.emit({
      type: 'node-item',
      nodeId,
      source,
      status: 'failed',
      bytesIn,
      ms: performance.now() - started,
      error: errorMessage(reason),
    })
    return undefined
  }
  deps.emit({
    type: 'node-item',
    nodeId,
    source,
    status: 'processed',
    bytesIn,
    bytesOut: sumSizes(outputs),
    ms: performance.now() - started,
    ...(recomputed ? { recomputed: true } : {}),
  })
  if (planned.definition.cacheable && deps.cache) {
    const record: StepCacheEntry = {
      nodeType: planned.definition.type,
      outputs: outputs.map((output, index) => ({
        port: output.port,
        key: outputKey(entry, index),
        meta: output.item.meta,
        reusesInput: reusable !== undefined && output.item.payload === reusable,
      })),
    }
    const payloads = outputs.map((output, index) => {
      if (record.outputs[index].reusesInput) return undefined
      const handler = deps.kinds?.[output.item.meta.kind]
      return handler ? handler.storable(output.item.payload) : output.item.payload
    })
    await deps.cache.store(entry, record, payloads)
  }
  return outputs
}

async function forward(deps: FlowDeps, planned: PlannedNode, port: string, ref: ItemRef) {
  for (const connection of planned.outgoing.get(port) ?? []) {
    if (deps.signal.aborted) return
    deps.emit({
      type: 'connection-item',
      connectionId: connection.id,
      format: ref.meta.format,
      bytes: ref.meta.size,
      sourceBytes: ref.meta.source.size,
    })
    await visit(deps, connection.target, ref)
  }
}

async function forwardOutputs(
  deps: FlowDeps,
  planned: PlannedNode,
  refs: { port: string; ref: ItemRef }[],
  status: 'processed' | 'cached',
) {
  for (const { port, ref } of refs) {
    if (deps.observe) await deps.observe(planned.node.id, port, await ref.get(), status)
    await forward(deps, planned, port, ref)
    ref.release()
  }
}

function cachedRefs(
  deps: FlowDeps,
  entry: string,
  cached: StepCacheEntry,
  order: number[],
  input: ItemRef | undefined,
  recompute: () => Promise<NodeOutput[] | undefined>,
) {
  let recomputed: Promise<NodeOutput[] | undefined> | undefined
  return cached.outputs.map((output, index) => ({
    port: output.port,
    ref: createRef(output.key, output.meta, [...order, index], async () => {
      if (output.reusesInput && input) {
        const source = await input.get()
        return { meta: output.meta, payload: source.payload }
      }
      const payload = await deps.cache?.load(entry, index)
      if (payload !== undefined) return { meta: output.meta, payload }
      recomputed ??= recompute()
      const outputs = await recomputed
      const item = outputs?.[index]?.item
      if (!item) throw new Error('An earlier step could not be rebuilt.')
      return item
    }),
  }))
}

async function visit(deps: FlowDeps, nodeId: string, ref: ItemRef): Promise<void> {
  if (deps.signal.aborted) return
  const planned = deps.plan.nodes.get(nodeId)
  if (!planned) return
  const source = sourceOf(ref.order)
  if (!planned.accepts.has(itemType(ref.meta.kind, ref.meta.format))) {
    deps.emit({ type: 'node-item', nodeId, source, status: 'skipped', ms: 0 })
    return
  }
  if (planned.definition.mode === 'all') {
    await deps.spill.put(nodeId, ref.order, ref.key, await ref.get())
    return
  }

  const entry = entryKey(planned.key, [ref.key])
  const execute = async (recomputed: boolean) => {
    let item: Item
    try {
      item = await ref.get()
    } catch (reason) {
      deps.emit({
        type: 'node-item',
        nodeId,
        source,
        status: 'failed',
        ms: 0,
        error: errorMessage(reason),
      })
      return undefined
    }
    return runNode(
      deps,
      planned,
      { mode: 'each', item },
      entry,
      item.meta.size,
      item.payload,
      recomputed,
      source,
    )
  }

  const cached =
    planned.definition.cacheable && deps.cache ? await deps.cache.lookup(entry) : undefined
  if (cached) {
    deps.emit({
      type: 'node-item',
      nodeId,
      source,
      status: 'cached',
      bytesIn: ref.meta.size,
      bytesOut: cached.outputs.every((output) => output.meta.size !== undefined)
        ? cached.outputs.reduce((total, output) => total + (output.meta.size ?? 0), 0)
        : undefined,
      ms: 0,
    })
    await forwardOutputs(
      deps,
      planned,
      cachedRefs(deps, entry, cached, ref.order, ref, () => execute(true)),
      'cached',
    )
    return
  }

  const outputs = await execute(false)
  if (!outputs) return
  await forwardOutputs(
    deps,
    planned,
    outputs.map((output, index) => ({
      port: output.port,
      ref: createRef(
        outputKey(entry, index),
        output.item.meta,
        [...ref.order, index],
        async () => output.item,
      ),
    })),
    'processed',
  )
}

export async function flowSource(deps: FlowDeps, source: SourceItem, load: () => Promise<Item>) {
  const files = deps.plan.nodes.get(deps.plan.filesId) as PlannedNode
  deps.emit({
    type: 'node-item',
    nodeId: files.node.id,
    source: source.index,
    status: 'processed',
    bytesOut: source.meta.size,
    ms: 0,
  })
  const ref = createRef(source.key, source.meta, [source.index], load)
  for (const [port] of files.outgoing) await forward(deps, files, port, ref)
  ref.release()
}

export async function flowCombining(deps: FlowDeps, nodeId: string) {
  const planned = deps.plan.nodes.get(nodeId)
  if (!planned || deps.signal.aborted) return
  const entries = await deps.spill.list(nodeId)
  if (entries.length === 0) return
  const entry = entryKey(
    planned.key,
    entries.map(({ key }) => key),
  )
  const order = [COMBINING_ORDER + deps.plan.combining.indexOf(nodeId)]
  const execute = (recomputed: boolean) => {
    async function* items() {
      for (const { key } of entries) yield await deps.spill.load(nodeId, key)
    }
    return runNode(
      deps,
      planned,
      { mode: 'all', items: items(), count: entries.length },
      entry,
      undefined,
      undefined,
      recomputed,
      undefined,
    )
  }

  const cached =
    planned.definition.cacheable && deps.cache ? await deps.cache.lookup(entry) : undefined
  if (cached) {
    deps.emit({ type: 'node-item', nodeId, status: 'cached', ms: 0 })
    await forwardOutputs(
      deps,
      planned,
      cachedRefs(deps, entry, cached, order, undefined, () => execute(true)),
      'cached',
    )
    return
  }
  const outputs = await execute(false)
  if (!outputs) return
  await forwardOutputs(
    deps,
    planned,
    outputs.map((output, index) => ({
      port: output.port,
      ref: createRef(
        outputKey(entry, index),
        output.item.meta,
        [...order, index],
        async () => output.item,
      ),
    })),
    'processed',
  )
}

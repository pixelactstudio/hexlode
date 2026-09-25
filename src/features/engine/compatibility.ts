import {
  describeTypes,
  FORMAT_LABELS,
  firstFormat,
  intersect,
  isSubset,
  narrowingLabel,
  union,
} from '#/features/engine/item-types'
import type {
  AnyNodeDefinition,
  Connection,
  ItemTypeSet,
  NodeRegistry,
  Pipeline,
  PipelineNode,
} from '#/features/engine/types'

export type ConnectionCheck =
  | { status: 'ok' }
  | { status: 'narrows'; label: string; message: string }
  | { status: 'refused'; message: string }

export interface ConnectionCandidate {
  source: string
  sourcePort: string
  target: string
}

export interface PipelineAnalysis {
  /** What can enter each node, before its accepts narrow it. */
  inputs: Map<string, ItemTypeSet>
  /** What can leave each port of each node, keyed `nodeId/portId`. */
  outputs: Map<string, ItemTypeSet>
  /** The check for each existing connection. */
  connections: Map<string, ConnectionCheck>
  /** Node ids in an order where every node follows the nodes that feed it. */
  order: string[]
}

const EMPTY: ItemTypeSet = new Set()

function definitionOf(registry: NodeRegistry, node: PipelineNode) {
  const definition = registry.get(node.type)
  if (!definition) throw new Error(`Unknown node type: ${node.type}`)
  return definition
}

export function settingsOf(definition: AnyNodeDefinition, node: PipelineNode) {
  return definition.parseSettings(node.settings)
}

export function topologicalOrder(pipeline: Pipeline) {
  const incoming = new Map(pipeline.nodes.map((node) => [node.id, 0]))
  for (const connection of pipeline.connections) {
    incoming.set(connection.target, (incoming.get(connection.target) ?? 0) + 1)
  }
  const ready = pipeline.nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id)
  const order: string[] = []
  while (ready.length > 0) {
    const id = ready.shift() as string
    order.push(id)
    for (const connection of pipeline.connections) {
      if (connection.source !== id) continue
      const remaining = (incoming.get(connection.target) ?? 0) - 1
      incoming.set(connection.target, remaining)
      if (remaining === 0) ready.push(connection.target)
    }
  }
  if (order.length !== pipeline.nodes.length) throw new Error('The pipeline contains a loop.')
  return order
}

function judge(
  produced: ItemTypeSet,
  target: AnyNodeDefinition,
  accepts: ItemTypeSet,
): ConnectionCheck {
  const entering = intersect(produced, accepts)
  if (entering.size === 0) {
    const needs = `${target.label} needs ${describeTypes(accepts)}.`
    const format = firstFormat(accepts, 'image')
    const producesImages = [...produced].some((type) => type.startsWith('image:'))
    const suggestion =
      format && producesImages ? ` Add Convert to ${FORMAT_LABELS[format]} before it.` : ''
    return { status: 'refused', message: `${needs}${suggestion}` }
  }
  if (isSubset(produced, accepts)) return { status: 'ok' }
  return {
    status: 'narrows',
    label: narrowingLabel(entering),
    message: `Only ${describeTypes(entering, 'and')} enter ${target.label}. Other items skip this branch.`,
  }
}

export function analysePipeline(pipeline: Pipeline, registry: NodeRegistry): PipelineAnalysis {
  const order = topologicalOrder(pipeline)
  const nodes = new Map(pipeline.nodes.map((node) => [node.id, node]))
  const inputs = new Map<string, ItemTypeSet>()
  const outputs = new Map<string, ItemTypeSet>()
  const connections = new Map<string, ConnectionCheck>()

  for (const id of order) {
    const node = nodes.get(id) as PipelineNode
    const definition = definitionOf(registry, node)
    const settings = settingsOf(definition, node)
    const incoming = pipeline.connections.filter((connection) => connection.target === id)
    const input = union(incoming.map((c) => outputs.get(`${c.source}/${c.sourcePort}`) ?? EMPTY))
    inputs.set(id, input)
    const accepts = definition.hasInput ? definition.accepts(settings) : EMPTY
    for (const connection of incoming) {
      const produced = outputs.get(`${connection.source}/${connection.sourcePort}`) ?? EMPTY
      connections.set(connection.id, judge(produced, definition, accepts))
    }
    const entering = definition.hasInput ? intersect(input, accepts) : EMPTY
    for (const port of definition.ports(settings)) {
      outputs.set(`${id}/${port.id}`, definition.produces(settings, entering, port.id))
    }
  }
  return { inputs, outputs, connections, order }
}

function reaches(pipeline: Pipeline, from: string, to: string): boolean {
  const pending = [from]
  const seen = new Set<string>()
  while (pending.length > 0) {
    const id = pending.pop() as string
    if (id === to) return true
    if (seen.has(id)) continue
    seen.add(id)
    for (const connection of pipeline.connections) {
      if (connection.source === id) pending.push(connection.target)
    }
  }
  return false
}

export function checkConnection(
  pipeline: Pipeline,
  registry: NodeRegistry,
  candidate: ConnectionCandidate,
): ConnectionCheck {
  const source = pipeline.nodes.find((node) => node.id === candidate.source)
  const target = pipeline.nodes.find((node) => node.id === candidate.target)
  if (!source || !target) return { status: 'refused', message: 'Both nodes must exist.' }
  const targetDefinition = definitionOf(registry, target)
  if (!targetDefinition.hasInput) {
    return {
      status: 'refused',
      message: `${targetDefinition.label} starts a pipeline and has no input.`,
    }
  }
  if (source.id === target.id || reaches(pipeline, target.id, source.id)) {
    return { status: 'refused', message: 'This connection would create a loop.' }
  }
  const duplicate = pipeline.connections.some(
    (connection: Connection) =>
      connection.source === candidate.source &&
      connection.sourcePort === candidate.sourcePort &&
      connection.target === candidate.target,
  )
  if (duplicate) return { status: 'refused', message: 'These nodes are already connected.' }

  const analysis = analysePipeline(pipeline, registry)
  const produced = analysis.outputs.get(`${candidate.source}/${candidate.sourcePort}`) ?? EMPTY
  const accepts = targetDefinition.accepts(settingsOf(targetDefinition, target))
  return judge(produced, targetDefinition, accepts)
}

/** Item types the Files node takes: everything that at least one of its branches accepts. */
export function filesAccepts(pipeline: Pipeline, registry: NodeRegistry, filesId: string) {
  const files = pipeline.nodes.find((node) => node.id === filesId)
  if (!files) return EMPTY
  const filesDefinition = definitionOf(registry, files)
  const filesSettings = settingsOf(filesDefinition, files)
  const branches = pipeline.connections
    .filter((connection) => connection.source === filesId)
    .map((connection) => {
      const target = nodes(pipeline).get(connection.target) as PipelineNode
      const definition = definitionOf(registry, target)
      const produced = filesDefinition.produces(filesSettings, EMPTY, connection.sourcePort)
      return intersect(produced, definition.accepts(settingsOf(definition, target)))
    })
  return union(branches)
}

function nodes(pipeline: Pipeline) {
  return new Map(pipeline.nodes.map((node) => [node.id, node]))
}

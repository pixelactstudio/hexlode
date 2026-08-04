import { WORKFLOW_DEFINITIONS, WORKFLOW_KINDS } from '#/features/canvas/workflow/constants'
import type {
  WorkflowConnection,
  WorkflowEdgeModel,
  WorkflowGraph,
  WorkflowKind,
  WorkflowNodeModel,
} from '#/features/canvas/workflow/types'

const NODE_HORIZONTAL_GAP = 240
const NODE_TOP_POSITION = 80
const NODE_BOTTOM_POSITION = 180

export class WorkflowGraphError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkflowGraphError'
  }
}

export function createNodePosition(index: number) {
  return {
    x: index * NODE_HORIZONTAL_GAP,
    y: index % 2 === 0 ? NODE_TOP_POSITION : NODE_BOTTOM_POSITION,
  }
}

export function createStarterGraph(): WorkflowGraph {
  const nodes = WORKFLOW_KINDS.map((kind, index) => ({
    id: kind,
    data: { kind },
    position: createNodePosition(index),
  }))
  const edges = WORKFLOW_KINDS.slice(0, -1).map((kind, index) => ({
    id: `${kind}-${WORKFLOW_KINDS[index + 1]}`,
    source: kind,
    target: WORKFLOW_KINDS[index + 1],
  }))

  return { nodes, edges }
}

export function getConnectionIssue(
  connection: WorkflowConnection,
  nodes: WorkflowNodeModel[],
  edges: WorkflowEdgeModel[],
  excludedEdgeId?: string,
) {
  const source = nodes.find((node) => node.id === connection.source)
  const target = nodes.find((node) => node.id === connection.target)
  if (!source || !target) return 'Connect two workflow nodes.'

  const sourceIndex = WORKFLOW_KINDS.indexOf(source.data.kind)
  const expectedKind = WORKFLOW_KINDS[sourceIndex + 1]
  if (target.data.kind !== expectedKind) {
    if (!expectedKind) return `${WORKFLOW_DEFINITIONS[source.data.kind].label} has no output port.`
    return `${WORKFLOW_DEFINITIONS[source.data.kind].label} connects only to ${WORKFLOW_DEFINITIONS[expectedKind].label}.`
  }

  const remainingEdges = edges.filter((edge) => edge.id !== excludedEdgeId)
  if (remainingEdges.some((edge) => edge.source === source.id)) {
    return `${WORKFLOW_DEFINITIONS[source.data.kind].label} already has an output connection.`
  }
  if (remainingEdges.some((edge) => edge.target === target.id)) {
    return `${WORKFLOW_DEFINITIONS[target.data.kind].label} already has an input connection.`
  }

  return null
}

export function compileWorkflow(nodes: WorkflowNodeModel[], edges: WorkflowEdgeModel[]) {
  if (nodes.length !== WORKFLOW_KINDS.length) {
    throw new WorkflowGraphError('Restore all six starter nodes before running the workflow.')
  }

  const nodesByKind = new Map<WorkflowKind, WorkflowNodeModel>()
  for (const node of nodes) {
    if (nodesByKind.has(node.data.kind)) {
      throw new WorkflowGraphError(`Keep one ${WORKFLOW_DEFINITIONS[node.data.kind].label} node.`)
    }
    nodesByKind.set(node.data.kind, node)
  }

  const orderedNodes = WORKFLOW_KINDS.map((kind) => nodesByKind.get(kind))
  if (orderedNodes.some((node) => !node)) {
    throw new WorkflowGraphError('Restore all six starter nodes before running the workflow.')
  }
  if (edges.length !== WORKFLOW_KINDS.length - 1) {
    throw new WorkflowGraphError('Connect the starter nodes into one complete pipeline.')
  }

  for (let index = 0; index < orderedNodes.length - 1; index += 1) {
    const source = orderedNodes[index]
    const target = orderedNodes[index + 1]
    if (!source || !target) continue

    const connectionCount = edges.filter(
      (edge) => edge.source === source.id && edge.target === target.id,
    ).length
    if (connectionCount !== 1) {
      throw new WorkflowGraphError(
        `Connect ${WORKFLOW_DEFINITIONS[source.data.kind].label} to ${WORKFLOW_DEFINITIONS[target.data.kind].label}.`,
      )
    }
  }

  return orderedNodes.map((node) => node?.id as string)
}

export const workflowKinds = ['files', 'inspect', 'resize', 'webp', 'compare', 'download'] as const

export type WorkflowKind = (typeof workflowKinds)[number]
export type WorkflowStatus = 'cancelled' | 'complete' | 'failed' | 'idle' | 'processing' | 'ready'

export interface WorkflowNodeModel {
  id: string
  data: { kind: WorkflowKind }
  position: { x: number; y: number }
}

export interface WorkflowEdgeModel {
  id: string
  source: string
  target: string
}

export interface WorkflowConnection {
  source: string | null
  target: string | null
}

export const workflowDefinitions: Record<
  WorkflowKind,
  { label: string; description: string; summary: string }
> = {
  files: {
    label: 'Files',
    description: 'Choose one local JPEG or PNG.',
    summary: 'JPEG or PNG',
  },
  inspect: {
    label: 'Inspect',
    description: 'Verify the signature, dimensions, and memory estimate.',
    summary: 'Safety checks',
  },
  resize: {
    label: 'Resize',
    description: 'Fit the long edge without upscaling.',
    summary: 'Max 1920 px',
  },
  webp: {
    label: 'WebP',
    description: 'Encode a local WebP output.',
    summary: 'Quality 82%',
  },
  compare: {
    label: 'Compare',
    description: 'Review dimensions and file-size savings.',
    summary: 'Before / after',
  },
  download: {
    label: 'Download',
    description: 'Save the output to this device.',
    summary: 'WebP file',
  },
}

export function createStarterGraph() {
  const nodes: WorkflowNodeModel[] = workflowKinds.map((kind, index) => ({
    id: kind,
    data: { kind },
    position: { x: index * 240, y: index % 2 === 0 ? 80 : 180 },
  }))
  const edges: WorkflowEdgeModel[] = workflowKinds.slice(0, -1).map((kind, index) => ({
    id: `${kind}-${workflowKinds[index + 1]}`,
    source: kind,
    target: workflowKinds[index + 1],
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

  const sourceIndex = workflowKinds.indexOf(source.data.kind)
  const expectedKind = workflowKinds[sourceIndex + 1]
  if (target.data.kind !== expectedKind) {
    if (!expectedKind) return `${workflowDefinitions[source.data.kind].label} has no output port.`
    const expected = workflowDefinitions[expectedKind].label
    return `${workflowDefinitions[source.data.kind].label} connects only to ${expected}.`
  }

  const remainingEdges = edges.filter((edge) => edge.id !== excludedEdgeId)
  if (remainingEdges.some((edge) => edge.source === source.id)) {
    return `${workflowDefinitions[source.data.kind].label} already has an output connection.`
  }
  if (remainingEdges.some((edge) => edge.target === target.id)) {
    return `${workflowDefinitions[target.data.kind].label} already has an input connection.`
  }

  return null
}

export class WorkflowGraphError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkflowGraphError'
  }
}

export function compileWorkflow(nodes: WorkflowNodeModel[], edges: WorkflowEdgeModel[]) {
  if (nodes.length !== workflowKinds.length) {
    throw new WorkflowGraphError('Restore all six starter nodes before running the workflow.')
  }

  const nodesByKind = new Map<WorkflowKind, WorkflowNodeModel>()
  for (const node of nodes) {
    if (nodesByKind.has(node.data.kind)) {
      throw new WorkflowGraphError(`Keep one ${workflowDefinitions[node.data.kind].label} node.`)
    }
    nodesByKind.set(node.data.kind, node)
  }

  const orderedNodes = workflowKinds.map((kind) => nodesByKind.get(kind))
  if (orderedNodes.some((node) => !node)) {
    throw new WorkflowGraphError('Restore all six starter nodes before running the workflow.')
  }
  if (edges.length !== workflowKinds.length - 1) {
    throw new WorkflowGraphError('Connect the starter nodes into one complete pipeline.')
  }

  for (let index = 0; index < orderedNodes.length - 1; index += 1) {
    const source = orderedNodes[index]
    const target = orderedNodes[index + 1]
    if (!source || !target) continue
    const matchingEdges = edges.filter(
      (edge) => edge.source === source.id && edge.target === target.id,
    )
    if (matchingEdges.length !== 1) {
      throw new WorkflowGraphError(
        `Connect ${workflowDefinitions[source.data.kind].label} to ${workflowDefinitions[target.data.kind].label}.`,
      )
    }
  }

  return orderedNodes.map((node) => node?.id as string)
}

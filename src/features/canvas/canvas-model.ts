import { MarkerType } from '@xyflow/react'

import type {
  ProcessedImage,
  SelectedImage,
  WorkflowCanvasEdge,
  WorkflowCanvasNode,
} from '#/features/canvas/types'
import { WORKFLOW_DEFINITIONS } from '#/features/canvas/workflow/constants'
import { createStarterGraph } from '#/features/canvas/workflow/graph'
import type {
  WorkflowEdgeModel,
  WorkflowKind,
  WorkflowNodeModel,
  WorkflowStatus,
} from '#/features/canvas/workflow/types'
import { formatBytes } from '#/lib/format-bytes'

interface NodeRuntime {
  activeNodeId: string | null
  cancelledNodeId: string | null
  downloaded: boolean
  failedNodeId: string | null
  maxDimension: number
  quality: number
  result: ProcessedImage | null
  savings: number | null
  selectedImage: SelectedImage | null
}

export function toNodeModels(nodes: WorkflowCanvasNode[]): WorkflowNodeModel[] {
  return nodes.map((node) => ({
    id: node.id,
    data: { kind: node.data.kind },
    position: node.position,
  }))
}

export function toEdgeModels(edges: WorkflowCanvasEdge[]): WorkflowEdgeModel[] {
  return edges.map(({ id, source, target }) => ({ id, source, target }))
}

export function createCanvasNode(model: WorkflowNodeModel, selected = false): WorkflowCanvasNode {
  return {
    ...model,
    selected,
    type: 'workflow',
    data: {
      kind: model.data.kind,
      status: 'idle',
      summary: WORKFLOW_DEFINITIONS[model.data.kind].summary,
    },
  }
}

export function createCanvasEdge(model: WorkflowEdgeModel): WorkflowCanvasEdge {
  return {
    ...model,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
  }
}

export function createInitialCanvas() {
  const graph = createStarterGraph()
  return {
    nodes: graph.nodes.map((node) => createCanvasNode(node, node.id === 'files')),
    edges: graph.edges.map(createCanvasEdge),
  }
}

export function outputFileName(sourceName: string) {
  const baseName = sourceName.replace(/\.[^.]+$/, '') || 'hexlode-output'
  return `${baseName}.webp`
}

export function getNodeStatus(node: WorkflowCanvasNode, runtime: NodeRuntime): WorkflowStatus {
  if (node.id === runtime.activeNodeId) return 'processing'
  if (node.id === runtime.failedNodeId) return 'failed'
  if (node.id === runtime.cancelledNodeId) return 'cancelled'

  switch (node.data.kind) {
    case 'files':
    case 'inspect':
      return runtime.selectedImage ? 'complete' : 'idle'
    case 'resize':
    case 'webp':
      return runtime.result ? 'complete' : runtime.selectedImage ? 'ready' : 'idle'
    case 'compare':
      return runtime.result ? 'complete' : 'idle'
    case 'download':
      return runtime.downloaded ? 'complete' : runtime.result ? 'ready' : 'idle'
  }
}

function nodeSummary(kind: WorkflowKind, runtime: NodeRuntime) {
  const { maxDimension, quality, result, savings, selectedImage } = runtime

  switch (kind) {
    case 'files':
      return selectedImage?.file.name ?? WORKFLOW_DEFINITIONS.files.summary
    case 'inspect':
      return selectedImage
        ? `${selectedImage.info.width} × ${selectedImage.info.height} ${selectedImage.info.format.toUpperCase()}`
        : WORKFLOW_DEFINITIONS.inspect.summary
    case 'resize':
      return `Max ${maxDimension} px`
    case 'webp':
      return `Quality ${quality}%`
    case 'compare':
      if (savings === null) return WORKFLOW_DEFINITIONS.compare.summary
      return savings >= 0
        ? `${savings.toFixed(1)}% smaller`
        : `${Math.abs(savings).toFixed(1)}% larger`
    case 'download':
      return selectedImage && result
        ? outputFileName(selectedImage.file.name)
        : WORKFLOW_DEFINITIONS.download.summary
  }
}

export function createDisplayNodes(nodes: WorkflowCanvasNode[], runtime: NodeRuntime) {
  return nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      status: getNodeStatus(node, runtime),
      summary: nodeSummary(node.data.kind, runtime),
    },
  }))
}

export function createDisplayEdges(
  edges: WorkflowCanvasEdge[],
  nodes: WorkflowCanvasNode[],
  runtime: NodeRuntime,
) {
  return edges.map((edge) => {
    const sourceKind = nodes.find((node) => node.id === edge.source)?.data.kind
    const containsOutput = sourceKind === 'webp' || sourceKind === 'compare'
    const size = containsOutput ? runtime.result?.size : runtime.selectedImage?.file.size

    return {
      ...edge,
      animated: edge.target === runtime.activeNodeId,
      label: size === undefined ? undefined : formatBytes(size),
    }
  })
}

export type WorkflowKind = 'files' | 'inspect' | 'resize' | 'webp' | 'compare' | 'download'
export type WorkflowStatus = 'cancelled' | 'complete' | 'failed' | 'idle' | 'processing' | 'ready'

export interface WorkflowDefinition {
  label: string
  description: string
  summary: string
}

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

export interface WorkflowGraph {
  nodes: WorkflowNodeModel[]
  edges: WorkflowEdgeModel[]
}

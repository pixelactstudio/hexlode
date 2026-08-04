import type { Edge, Node } from '@xyflow/react'

import type { WorkflowKind, WorkflowStatus } from '#/features/canvas/workflow/types'
import type { ImageInfo } from '#/features/image-input/types'

export type { ProcessedImage } from '#/features/processing/types'

export interface WorkflowNodeData extends Record<string, unknown> {
  kind: WorkflowKind
  status: WorkflowStatus
  summary: string
}

export type WorkflowCanvasNode = Node<WorkflowNodeData, 'workflow'>
export type WorkflowCanvasEdge = Edge

export interface GraphSnapshot {
  nodes: WorkflowCanvasNode[]
  edges: WorkflowCanvasEdge[]
}

export interface SelectedImage {
  file: File
  info: ImageInfo
  previewUrl: string
}

export type RunState = 'cancelled' | 'complete' | 'idle' | 'processing'

export interface RuntimeEvent {
  elapsedMs: number
  id: string
  label: string
  progress: number
  stage: string
}

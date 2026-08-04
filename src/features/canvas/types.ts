import type { Edge, Node } from '@xyflow/react'

import type { WorkflowKind, WorkflowStatus } from '#/features/canvas/workflow/types'
import type { ImageInfo } from '#/features/image-input/types'

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

export interface ProcessedImage {
  durationMs: number
  height: number
  size: number
  warnings: string[]
  width: number
}

export type RunState = 'cancelled' | 'complete' | 'idle' | 'processing'

import type { WorkflowKind } from '#/features/canvas/workflow/types'
import type { ProcessingOptions } from '#/features/processing/types'

export interface RecipeNode {
  id: string
  kind: WorkflowKind
}

export interface RecipeEdge {
  id: string
  source: string
  target: string
}

export interface Recipe {
  createdAt: string
  execution: ProcessingOptions & { renameTemplate: string }
  graph: { edges: RecipeEdge[]; nodes: RecipeNode[] }
  id: string
  kind: 'macro' | 'recipe'
  layout: { positions: Record<string, { x: number; y: number }> }
  name: string
  schemaVersion: 1
  updatedAt: string
}

export interface LocalPreferences {
  airgap: boolean
  mode: 'local' | 'private'
}

export interface RunRecord {
  completed: number
  durationMs: number
  failed: number
  format: ProcessingOptions['format']
  id: string
  sourceCount: number
  totalOutputBytes: number
  updatedAt: string
}

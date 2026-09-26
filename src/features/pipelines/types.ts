import type { Pipeline } from '#/features/engine/types'

export interface NamedPipeline {
  name: string
  pipeline: Pipeline
}

export interface SavedPipeline extends NamedPipeline {
  id: string
  createdAt: number
  updatedAt: number
}

export interface Template extends NamedPipeline {
  id: string
  description: string
}

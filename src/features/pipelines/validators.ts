import { z } from 'zod'

import { MAX_PIPELINE_NAME_LENGTH } from '#/features/pipelines/constants'

export const pipelineSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string().min(1).max(80),
      type: z.string().min(1).max(80),
      settings: z.record(z.string(), z.unknown()),
      position: z.object({ x: z.number(), y: z.number() }),
    }),
  ),
  connections: z.array(
    z.object({
      id: z.string().min(1).max(200),
      source: z.string().min(1),
      sourcePort: z.string().min(1),
      target: z.string().min(1),
    }),
  ),
})

export const pipelineFileSchema = z.object({
  format: z.string(),
  version: z.number().int(),
  name: z.string().max(MAX_PIPELINE_NAME_LENGTH),
  pipeline: pipelineSchema,
})

export const savedPipelinesSchema = z.array(
  z.object({
    id: z.string().min(1),
    name: z.string().max(MAX_PIPELINE_NAME_LENGTH),
    createdAt: z.number(),
    updatedAt: z.number(),
    pipeline: pipelineSchema,
  }),
)

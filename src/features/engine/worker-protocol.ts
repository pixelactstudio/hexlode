/**
 * Messages between the main thread and engine workers. Both sides validate what they receive.
 */
import { z } from 'zod'

const meta = z.object({
  kind: z.enum(['image', 'data', 'document']),
  format: z.string(),
  name: z.string(),
  size: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  orientation: z.number().optional(),
  source: z.object({
    size: z.number(),
    format: z.string(),
    width: z.number().optional(),
    height: z.number().optional(),
  }),
})

const pipeline = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      settings: z.record(z.string(), z.unknown()),
      position: z.object({ x: z.number(), y: z.number() }),
    }),
  ),
  connections: z.array(
    z.object({ id: z.string(), source: z.string(), sourcePort: z.string(), target: z.string() }),
  ),
})

export const workerRequestSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('begin'),
    runId: z.string().min(1),
    pipeline,
    stepCache: z.boolean(),
  }),
  z.object({
    type: z.literal('source'),
    taskId: z.string().min(1),
    source: z.object({
      index: z.number().int().nonnegative(),
      key: z.string().min(1),
      meta,
      file: z.custom<Blob>((value) => value instanceof Blob),
    }),
  }),
  z.object({ type: z.literal('gather'), taskId: z.string().min(1), nodeId: z.string().min(1) }),
])

const stepCacheEntry = z.object({
  nodeType: z.string(),
  outputs: z.array(z.object({ port: z.string(), key: z.string(), meta, reusesInput: z.boolean() })),
})

export const workerResponseSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('event'),
    taskId: z.string(),
    event: z.object({ type: z.string() }).loose(),
  }),
  z.object({ type: z.literal('cache-used'), key: z.string() }),
  z.object({
    type: z.literal('cache-stored'),
    key: z.string(),
    bytes: z.number().nonnegative(),
    entry: stepCacheEntry,
  }),
  z.object({
    type: z.literal('output'),
    written: z.object({
      nodeId: z.string(),
      name: z.string(),
      file: z.string(),
      size: z.number().nonnegative(),
    }),
  }),
  z.object({ type: z.literal('done'), taskId: z.string() }),
  z.object({ type: z.literal('failed'), taskId: z.string(), message: z.string() }),
])

export type WorkerRequest = z.infer<typeof workerRequestSchema>
export type WorkerResponse = z.infer<typeof workerResponseSchema>

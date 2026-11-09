import { z } from 'zod'

export const previewRequestSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('sample'),
    requestId: z.number().int(),
    file: z.custom<Blob>((value) => value instanceof Blob),
    name: z.string(),
  }),
  /** A port to the shared inference worker, sent before the first render that needs a model. */
  z.object({
    type: z.literal('inference'),
    port: z.custom<MessagePort>((value) => value instanceof MessagePort),
  }),
  z.object({
    type: z.literal('render'),
    requestId: z.number().int(),
    pipeline: z.object({
      nodes: z.array(z.object({ id: z.string(), type: z.string() }).loose()),
      connections: z.array(z.object({ id: z.string() }).loose()),
    }),
  }),
])

export type PreviewRequest = z.infer<typeof previewRequestSchema>

const blob = z.custom<Blob>((value) => value instanceof Blob)

export const nodePreviewSchema = z.object({
  nodeId: z.string(),
  status: z.enum(['processed', 'cached', 'skipped', 'failed']),
  format: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  size: z.number().optional(),
  thumbnail: blob.optional(),
  /** The start of the first data item the node made, such as JSON, CSS or HTML. */
  text: z.string().optional(),
  /** Compare nodes: the sample as it entered the pipeline, and as it reached the node. */
  before: blob.optional(),
  after: blob.optional(),
  error: z.string().optional(),
  warnings: z.array(z.string()),
})

export type NodePreview = z.infer<typeof nodePreviewSchema>

export const previewResponseSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('sample'),
    requestId: z.number(),
    name: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    format: z.string().optional(),
    error: z.string().optional(),
  }),
  z.object({
    type: z.literal('render'),
    requestId: z.number(),
    nodes: z.array(nodePreviewSchema),
    error: z.string().optional(),
    /** A newer render replaced this one before it started. */
    superseded: z.boolean().optional(),
  }),
])

export type PreviewResponse = z.infer<typeof previewResponseSchema>

/** A preview of one file, for files the browser cannot show itself. */
export const thumbnailRequestSchema = z.object({
  id: z.number().int(),
  file: blob,
  name: z.string(),
  edge: z.number().int().positive(),
})

export type ThumbnailRequest = z.infer<typeof thumbnailRequestSchema>

export const thumbnailResponseSchema = z.object({
  id: z.number().int(),
  /** A PNG of the image, upright and no larger than the edge. */
  image: blob.optional(),
  error: z.string().optional(),
})

export type ThumbnailResponse = z.infer<typeof thumbnailResponseSchema>

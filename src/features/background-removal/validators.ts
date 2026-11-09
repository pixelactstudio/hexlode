/**
 * Messages of the shared inference worker. Engine and preview workers talk to it through their
 * own MessagePort; the page that owns it hears how runs went. Every side validates what it reads.
 */
import { z } from 'zod'

const backend = z.enum(['webgpu', 'wasm'])

/** From the page: a port for one more engine or preview worker. */
export const inferenceControlSchema = z.object({
  type: z.literal('connect'),
  port: z.custom<MessagePort>((value) => value instanceof MessagePort),
})

/** From a connected worker: find the subject of a square image of the model's input size. */
export const segmentRequestSchema = z.object({
  type: z.literal('segment'),
  id: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  data: z.custom<Uint8ClampedArray>((value) => value instanceof Uint8ClampedArray),
})

export const segmentResponseSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('mask'),
    id: z.number().int(),
    mask: z.custom<Uint8Array>((value) => value instanceof Uint8Array),
  }),
  z.object({
    type: z.literal('error'),
    id: z.number().int(),
    code: z.string(),
    message: z.string(),
  }),
])

/** To the page: how the model started and each run went, for estimates and analytics. */
export const inferenceReportSchema = z.discriminatedUnion('type', [
  /** The worker's script loaded, so ports can be handed over. */
  z.object({ type: z.literal('ready') }),
  z.object({ type: z.literal('started'), backend, ms: z.number().nonnegative() }),
  z.object({ type: z.literal('ran'), backend, ms: z.number().nonnegative() }),
  z.object({ type: z.literal('failed'), code: z.string() }),
])

export type SegmentRequest = z.infer<typeof segmentRequestSchema>
export type SegmentResponse = z.infer<typeof segmentResponseSchema>
export type InferenceReport = z.infer<typeof inferenceReportSchema>

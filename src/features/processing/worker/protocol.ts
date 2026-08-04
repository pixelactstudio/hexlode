import { z } from 'zod'

import { processingOptionsSchema } from '#/features/processing/validators'

const arrayBufferSchema = z.custom<ArrayBuffer>((value) => value instanceof ArrayBuffer)

export const processImageRequestSchema = z.object({
  type: z.literal('process'),
  id: z.string().min(1),
  input: z.object({
    buffer: arrayBufferSchema,
    mimeType: z.enum(['image/jpeg', 'image/png']),
  }),
  options: processingOptionsSchema,
})

export const workerResponseSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('progress'),
    id: z.string(),
    stage: z.enum(['decode', 'resize', 'encode']),
    progress: z.number().min(0).max(100),
  }),
  z.object({
    type: z.literal('result'),
    id: z.string(),
    output: arrayBufferSchema,
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    durationMs: z.number().nonnegative(),
    warnings: z.array(z.string()),
  }),
  z.object({
    type: z.literal('error'),
    id: z.string(),
    code: z.enum(['unsupported_browser', 'decode_failed', 'encode_failed', 'invalid_message']),
    message: z.string(),
  }),
])

export type ProcessImageRequest = z.infer<typeof processImageRequestSchema>
export type WorkerResponse = z.infer<typeof workerResponseSchema>
export type WorkerProgress = Extract<WorkerResponse, { type: 'progress' }>
export type WorkerResult = Extract<WorkerResponse, { type: 'result' }>

import { z } from 'zod'

import { MAX_OUTPUT_DIMENSION, MIN_OUTPUT_DIMENSION } from '#/features/processing/constants'

export const processingOptionsSchema = z.object({
  format: z.enum(['jpeg', 'png', 'webp']),
  maxDimension: z.number().int().min(MIN_OUTPUT_DIMENSION).max(MAX_OUTPUT_DIMENSION),
  quality: z.number().int().min(1).max(100),
})

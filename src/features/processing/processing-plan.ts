import { z } from 'zod'

import type { ImageInfo } from '#/features/image-input/image-validation'

export const DEFAULT_MAX_DIMENSION = 1_920
export const DEFAULT_WEBP_QUALITY = 82
export const MAX_OUTPUT_DIMENSION = 8_192
export const MAX_ESTIMATED_PEAK_BYTES = 320 * 1024 * 1024

export const processingOptionsSchema = z.object({
  maxDimension: z.number().int().min(32).max(MAX_OUTPUT_DIMENSION),
  quality: z.number().int().min(1).max(100),
})

export type ProcessingOptions = z.infer<typeof processingOptionsSchema>

export interface ProcessingPlan {
  width: number
  height: number
  estimatedPeakBytes: number
}

export function calculateTargetSize(width: number, height: number, maxDimension: number) {
  const scale = Math.min(1, maxDimension / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export function createProcessingPlan(image: ImageInfo, options: ProcessingOptions): ProcessingPlan {
  const parsedOptions = processingOptionsSchema.parse(options)
  const target = calculateTargetSize(image.width, image.height, parsedOptions.maxDimension)
  const estimatedPeakBytes = image.estimatedDecodeBytes + target.width * target.height * 4

  if (estimatedPeakBytes > MAX_ESTIMATED_PEAK_BYTES) {
    throw new Error('This resize could exceed the safe working-memory limit.')
  }

  return { ...target, estimatedPeakBytes }
}

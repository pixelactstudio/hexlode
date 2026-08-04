import type { ImageInfo } from '#/features/image-input/types'
import { MAX_ESTIMATED_PEAK_BYTES } from '#/features/processing/constants'
import type { ProcessingOptions, ProcessingPlan } from '#/features/processing/types'
import { processingOptionsSchema } from '#/features/processing/validators'

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

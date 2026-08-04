import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { ImageInfo } from '#/features/image-input/types'
import { calculateTargetSize, createProcessingPlan } from '#/features/processing/processing-plan'

describe('processing plan', () => {
  it('preserves aspect ratio and never upscales', () => {
    assert.deepEqual(calculateTargetSize(4000, 3000, 1920), { width: 1920, height: 1440 })
    assert.deepEqual(calculateTargetSize(640, 480, 1920), { width: 640, height: 480 })
  })

  it('includes decoded source and output pixels in the peak estimate', () => {
    const image: ImageInfo = {
      format: 'jpeg',
      mimeType: 'image/jpeg',
      width: 4000,
      height: 3000,
      estimatedDecodeBytes: 48_000_000,
    }
    assert.deepEqual(createProcessingPlan(image, { maxDimension: 2000, quality: 82 }), {
      width: 2000,
      height: 1500,
      estimatedPeakBytes: 60_000_000,
    })
  })

  it('rejects plans above the working-memory limit', () => {
    const image: ImageInfo = {
      format: 'png',
      mimeType: 'image/png',
      width: 8192,
      height: 8192,
      estimatedDecodeBytes: 256 * 1024 * 1024,
    }
    assert.throws(() => createProcessingPlan(image, { maxDimension: 8192, quality: 82 }))
  })
})

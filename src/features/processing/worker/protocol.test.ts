import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  processImageRequestSchema,
  workerResponseSchema,
} from '#/features/processing/worker/protocol'

describe('worker protocol', () => {
  it('accepts bounded requests and rejects invalid quality', () => {
    const request = {
      type: 'process',
      id: 'job-1',
      input: { buffer: new ArrayBuffer(4), mimeType: 'image/png' },
      options: { maxDimension: 1920, quality: 82 },
    }
    assert.equal(processImageRequestSchema.safeParse(request).success, true)
    assert.equal(
      processImageRequestSchema.safeParse({
        ...request,
        options: { ...request.options, quality: 101 },
      }).success,
      false,
    )
  })

  it('rejects malformed worker responses', () => {
    assert.equal(
      workerResponseSchema.safeParse({
        type: 'progress',
        id: 'job-1',
        stage: 'encode',
        progress: 140,
      }).success,
      false,
    )
  })
})

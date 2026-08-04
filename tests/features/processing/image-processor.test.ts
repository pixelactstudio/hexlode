import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ImageProcessor, ProcessingError } from '#/features/processing/image-processor'
import type { ProcessingWorker } from '#/features/processing/types'

class WaitingWorker implements ProcessingWorker {
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  isTerminated = false

  postMessage() {}

  terminate() {
    this.isTerminated = true
  }
}

describe('ImageProcessor cancellation', () => {
  it('terminates the active worker and rejects the job as cancelled', async () => {
    const worker = new WaitingWorker()
    const processor = new ImageProcessor(() => worker)
    const pending = processor.process(
      new ArrayBuffer(8),
      'image/png',
      { maxDimension: 1920, quality: 82 },
      () => {},
    )

    processor.cancel()

    await assert.rejects(
      pending,
      (error) => error instanceof ProcessingError && error.code === 'cancelled',
    )
    assert.equal(worker.isTerminated, true)
  })
})

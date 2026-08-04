import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ImageProcessor, ProcessingError } from '#/features/processing/image-processor'
import type { ProcessingWorker } from '#/features/processing/types'

class WaitingWorker implements ProcessingWorker {
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  isTerminated = false
  postCount = 0

  postMessage() {
    this.postCount += 1
  }

  terminate() {
    this.isTerminated = true
  }
}

class ThrowingWorker extends WaitingWorker {
  override postMessage() {
    throw new Error('Transfer failed.')
  }
}

describe('ImageProcessor', () => {
  it('terminates the active worker and rejects the job as cancelled', async () => {
    const worker = new WaitingWorker()
    const processor = new ImageProcessor(() => worker)
    const pending = processor.process(
      new ArrayBuffer(8),
      'image/png',
      { format: 'webp', maxDimension: 1920, quality: 82 },
      () => {},
    )

    processor.cancel()

    await assert.rejects(
      pending,
      (error) => error instanceof ProcessingError && error.code === 'cancelled',
    )
    assert.equal(worker.isTerminated, true)
  })

  it('rejects invalid options before creating an active job', async () => {
    const worker = new WaitingWorker()
    const processor = new ImageProcessor(() => worker)

    await assert.rejects(
      processor.process(
        new ArrayBuffer(8),
        'image/png',
        { format: 'webp', maxDimension: 16, quality: 82 },
        () => {},
      ),
      (error) => error instanceof ProcessingError && error.code === 'invalid_message',
    )
    assert.equal(worker.postCount, 0)

    const validJob = processor.process(
      new ArrayBuffer(8),
      'image/png',
      { format: 'webp', maxDimension: 1920, quality: 82 },
      () => {},
    )
    assert.equal(worker.postCount, 1)
    processor.cancel()
    await assert.rejects(validJob)
  })

  it('rejects transfer failures and allows the next job to start', async () => {
    const worker = new ThrowingWorker()
    const processor = new ImageProcessor(() => worker)
    const process = () =>
      processor.process(
        new ArrayBuffer(8),
        'image/png',
        { format: 'webp', maxDimension: 1920, quality: 82 },
        () => {},
      )

    await assert.rejects(
      process(),
      (error) =>
        error instanceof ProcessingError &&
        error.code === 'worker_failed' &&
        error.message === 'Transfer failed.',
    )
    assert.equal(worker.isTerminated, true)
    await assert.rejects(
      process(),
      (error) => error instanceof ProcessingError && error.message === 'Transfer failed.',
    )
  })
})

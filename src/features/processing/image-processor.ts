import type {
  ProcessingErrorCode,
  ProcessingOptions,
  ProcessingWorker,
  ProcessingWorkerFactory,
} from '#/features/processing/types'
import {
  processImageRequestSchema,
  type WorkerProgress,
  type WorkerResult,
  workerResponseSchema,
} from '#/features/processing/worker/protocol'
import { createId } from '#/lib/create-id'

interface ActiveJob {
  id: string
  onProgress: (progress: WorkerProgress) => void
  reject: (error: ProcessingError) => void
  resolve: (result: WorkerResult) => void
}

export class ProcessingError extends Error {
  constructor(
    readonly code: ProcessingErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ProcessingError'
  }
}

function defaultWorkerFactory(): ProcessingWorker {
  return new Worker(new URL('./worker/image-worker.ts', import.meta.url), { type: 'module' })
}

export class ImageProcessor {
  private worker: ProcessingWorker | null = null
  private activeJob: ActiveJob | null = null

  constructor(private readonly createWorker: ProcessingWorkerFactory = defaultWorkerFactory) {}

  process(
    buffer: ArrayBuffer,
    mimeType: 'image/jpeg' | 'image/png',
    options: ProcessingOptions,
    onProgress: (progress: WorkerProgress) => void,
  ) {
    if (this.activeJob) {
      return Promise.reject(
        new ProcessingError('worker_failed', 'Finish or cancel the current image first.'),
      )
    }

    const id = createId()
    const request = processImageRequestSchema.safeParse({
      type: 'process',
      id,
      input: { buffer, mimeType },
      options,
    })
    if (!request.success) {
      return Promise.reject(
        new ProcessingError('invalid_message', 'The processing request is invalid.'),
      )
    }

    const worker = this.getWorker()
    const result = new Promise<WorkerResult>((resolve, reject) => {
      this.activeJob = { id, onProgress, reject, resolve }
    })

    try {
      worker.postMessage(request.data, [buffer])
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : 'The image could not reach the worker.'
      this.failActiveJob(new ProcessingError('worker_failed', message))
    }

    return result
  }

  cancel() {
    if (!this.activeJob) return
    const job = this.activeJob
    this.activeJob = null
    this.recycleWorker()
    job.reject(new ProcessingError('cancelled', 'Processing was cancelled.'))
  }

  dispose() {
    this.cancel()
    this.recycleWorker()
  }

  private getWorker() {
    if (this.worker) return this.worker

    const worker = this.createWorker()
    worker.onmessage = (event) => this.handleMessage(event.data)
    worker.onerror = (event) => {
      this.failActiveJob(
        new ProcessingError('worker_failed', event.message || 'The image worker failed.'),
      )
    }
    this.worker = worker
    return worker
  }

  private handleMessage(message: unknown) {
    const parsed = workerResponseSchema.safeParse(message)
    if (!parsed.success) {
      this.failActiveJob(
        new ProcessingError('invalid_message', 'The image worker returned an invalid response.'),
      )
      return
    }

    const job = this.activeJob
    const response = parsed.data
    if (!job || response.id !== job.id) return

    if (response.type === 'progress') {
      job.onProgress(response)
      return
    }

    this.activeJob = null
    if (response.type === 'error') {
      job.reject(new ProcessingError(response.code, response.message))
      return
    }

    job.resolve(response)
  }

  private failActiveJob(error: ProcessingError) {
    const job = this.activeJob
    this.activeJob = null
    this.recycleWorker()
    job?.reject(error)
  }

  private recycleWorker() {
    this.worker?.terminate()
    this.worker = null
  }
}

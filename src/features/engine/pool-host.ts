/**
 * Runs flows in a pool of engine workers. Each worker carries one source item at a time through
 * the whole pipeline, so the number of items held in memory is bounded by the pool size, not by
 * the batch size.
 */
import { appDirectory } from '#/features/engine/opfs/files'
import {
  clearRuns,
  createOpfsOutputStore,
  type FolderTarget,
} from '#/features/engine/opfs/run-stores'
import type { StepCacheIndex } from '#/features/engine/opfs/step-cache'
import type { RunHost } from '#/features/engine/runner'
import type { OutputStore } from '#/features/engine/stores'
import type { RunEvent } from '#/features/engine/types'
import {
  type WorkerRequest,
  type WorkerResponse,
  workerResponseSchema,
} from '#/features/engine/worker-protocol'
import { createId } from '#/lib/create-id'

export interface PoolHostOptions {
  size: number
  createWorker: () => Worker
  /** The step cache index, or null to run without a step cache. */
  index: StepCacheIndex | null
  root?: FileSystemDirectoryHandle
  folders?: Map<string, FolderTarget>
  archiveNames?: Map<string, string>
}

interface Task {
  emit: (event: RunEvent) => void
  resolve: () => void
  reject: (reason: Error) => void
}

interface PoolWorker {
  worker: Worker
  busy: boolean
}

export function createWorkerPoolHost(options: PoolHostOptions): RunHost & { dispose(): void } {
  const tasks = new Map<string, Task>()
  let workers: PoolWorker[] = []
  let waiting: ((worker: PoolWorker) => void)[] = []
  let output:
    | (OutputStore & { record: ReturnType<typeof createOpfsOutputStore>['record'] })
    | undefined
  let beginMessage: WorkerRequest | undefined

  const onMessage = (event: MessageEvent<unknown>) => {
    const parsed = workerResponseSchema.safeParse(event.data)
    if (!parsed.success) return
    const message: WorkerResponse = parsed.data
    switch (message.type) {
      case 'event':
        tasks.get(message.taskId)?.emit(message.event as unknown as RunEvent)
        break
      case 'cache-used':
        options.index?.used(message.key)
        break
      case 'cache-stored':
        void options.index?.stored(message.key, message.bytes, message.entry as never)
        break
      case 'output':
        output?.record(message.written)
        break
      case 'done':
        tasks.get(message.taskId)?.resolve()
        tasks.delete(message.taskId)
        break
      case 'failed':
        tasks.get(message.taskId)?.reject(new Error(message.message))
        tasks.delete(message.taskId)
        break
    }
  }

  const spawn = (): PoolWorker => {
    const worker = options.createWorker()
    worker.onmessage = onMessage
    const entry: PoolWorker = { worker, busy: false }
    worker.onerror = (event) => {
      event.preventDefault()
      for (const [taskId, task] of tasks) {
        task.reject(new Error(event.message || 'A worker stopped unexpectedly.'))
        tasks.delete(taskId)
      }
    }
    if (beginMessage) worker.postMessage(beginMessage)
    return entry
  }

  const terminateAll = () => {
    for (const { worker } of workers) worker.terminate()
    workers = []
    for (const task of tasks.values()) task.reject(new Error('The run was cancelled.'))
    tasks.clear()
  }

  const acquire = () =>
    new Promise<PoolWorker>((resolve) => {
      const idle = workers.find((entry) => !entry.busy)
      if (idle) {
        idle.busy = true
        resolve(idle)
      } else {
        waiting.push((entry) => {
          entry.busy = true
          resolve(entry)
        })
      }
    })

  const release = (entry: PoolWorker) => {
    entry.busy = false
    const next = waiting.shift()
    if (next) next(entry)
  }

  const dispatch = async (
    request: (taskId: string) => WorkerRequest,
    emit: (event: RunEvent) => void,
    signal: AbortSignal,
  ) => {
    if (signal.aborted) return
    const entry = await acquire()
    const taskId = createId()
    const onAbort = () => terminateAll()
    signal.addEventListener('abort', onAbort, { once: true })
    try {
      await new Promise<void>((resolve, reject) => {
        tasks.set(taskId, { emit, resolve, reject })
        const message = request(taskId)
        entry.worker.postMessage(message)
      })
    } finally {
      signal.removeEventListener('abort', onAbort)
      if (workers.includes(entry)) release(entry)
    }
  }

  return {
    concurrency: options.size,
    async begin({ runId, pipeline }) {
      const root = options.root ?? (await appDirectory())
      await clearRuns(root, runId)
      output = createOpfsOutputStore(root, runId, {
        folders: options.folders,
        archiveNames: options.archiveNames,
      })
      beginMessage = { type: 'begin', runId, pipeline, stepCache: options.index !== null }
      waiting = []
      if (workers.length !== options.size) {
        for (const { worker } of workers) worker.terminate()
        workers = Array.from({ length: options.size }, spawn)
      } else {
        for (const { worker } of workers) worker.postMessage(beginMessage)
      }
    },
    runSource(source, emit, signal) {
      if (!source.file) throw new Error('Worker runs need the file of each source item.')
      const file = source.file
      return dispatch(
        (taskId) => ({
          type: 'source',
          taskId,
          source: { index: source.index, key: source.key, meta: source.meta, file },
        }),
        emit,
        signal,
      )
    },
    runGather(nodeId, emit, signal) {
      return dispatch((taskId) => ({ type: 'gather', taskId, nodeId }), emit, signal)
    },
    deliver(nodeId) {
      if (!output) throw new Error('The run has not started.')
      return output.deliver(nodeId)
    },
    async end() {
      await options.index?.persist()
    },
    dispose: terminateAll,
  }
}

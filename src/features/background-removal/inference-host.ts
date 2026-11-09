/**
 * The page's side of the shared inference worker. It starts the worker the first time a run or a
 * preview needs a model, hands each engine or preview worker its own MessagePort to it, and keeps
 * what the worker reports: which backend ran and how long starting and each run took, which
 * estimates and analytics use.
 */
import type { InferenceBackend } from '#/features/background-removal/types'
import {
  inferenceReportSchema,
  type SegmentResponse,
  segmentRequestSchema,
} from '#/features/background-removal/validators'

/** Shown when the inference worker's script fails to load, as when the server cannot be reached. */
export const INFERENCE_LOAD_FAILED_MESSAGE =
  'Hexlode could not start background removal. Check your connection and reload the page.'

/** Answers every request on a port with the load failure, so no run waits for a dead worker. */
function refuse(port: MessagePort) {
  port.onmessage = (event: MessageEvent<unknown>) => {
    const parsed = segmentRequestSchema.safeParse(event.data)
    if (!parsed.success) return
    const response: SegmentResponse = {
      type: 'error',
      id: parsed.data.id,
      code: 'inference_unavailable',
      message: INFERENCE_LOAD_FAILED_MESSAGE,
    }
    port.postMessage(response)
  }
}

export interface InferenceStats {
  backend: InferenceBackend | null
  /** How long the model took to start in this page, once it has. */
  startMs: number | null
  runs: number
  runMs: number
  failureCodes: string[]
}

const emptyStats = (): InferenceStats => ({
  backend: null,
  startMs: null,
  runs: 0,
  runMs: 0,
  failureCodes: [],
})

export function createInferenceHost(createWorker: () => Worker) {
  let worker: Worker | undefined
  /** Ports wait here until the worker's script has loaded and said so. */
  let waiting: MessagePort[] = []
  let ready = false
  let stats = emptyStats()
  /** Runs counted since `takeStats` last read them, for one run's analytics. */
  let pending = emptyStats()

  const handOver = (port: MessagePort) => worker?.postMessage({ type: 'connect', port }, [port])

  const fail = (code: string) => {
    for (const target of [stats, pending]) {
      if (!target.failureCodes.includes(code)) target.failureCodes.push(code)
    }
  }

  const onMessage = (event: MessageEvent<unknown>) => {
    const parsed = inferenceReportSchema.safeParse(event.data)
    if (!parsed.success) return
    const message = parsed.data
    if (message.type === 'ready') {
      ready = true
      for (const port of waiting) handOver(port)
      waiting = []
      return
    }
    for (const target of [stats, pending]) {
      if (message.type === 'started') {
        target.backend = message.backend
        target.startMs = message.ms
      } else if (message.type === 'ran') {
        target.backend = message.backend
        target.runs += 1
        target.runMs += message.ms
      } else if (!target.failureCodes.includes(message.code)) {
        target.failureCodes.push(message.code)
      }
    }
  }

  return {
    /** A port to the inference worker for one engine or preview worker. Starts the worker. */
    connect(): MessagePort {
      if (!worker) {
        const created = createWorker()
        worker = created
        ready = false
        created.onmessage = onMessage
        created.onerror = (event) => {
          // A script that cannot load errors before it is ready. Later calls start a new worker.
          if (ready) return
          event.preventDefault()
          created.terminate()
          if (worker === created) worker = undefined
          fail('inference_unavailable')
          for (const port of waiting) refuse(port)
          waiting = []
        }
      }
      const channel = new MessageChannel()
      if (ready) handOver(channel.port1)
      else waiting.push(channel.port1)
      return channel.port2
    },
    /** Everything measured in this page. */
    stats: (): InferenceStats => ({ ...stats, failureCodes: [...stats.failureCodes] }),
    /** What was measured since the last call, then starts counting again. */
    takeStats(): InferenceStats {
      const taken = pending
      pending = emptyStats()
      return taken
    },
    dispose() {
      worker?.terminate()
      worker = undefined
      ready = false
      waiting = []
      stats = emptyStats()
      pending = emptyStats()
    },
  }
}

export type InferenceHost = ReturnType<typeof createInferenceHost>

export function createInferenceWorker() {
  return new Worker(new URL('./inference.worker.ts', import.meta.url), { type: 'module' })
}

let shared: InferenceHost | undefined

/** The page's one inference host, so every run and preview shares one copy of the model. */
export function inferenceHost() {
  shared ??= createInferenceHost(createInferenceWorker)
  return shared
}

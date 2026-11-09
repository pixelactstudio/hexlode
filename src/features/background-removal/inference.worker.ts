/// <reference lib="webworker" />
/**
 * The shared inference worker: one per page, holding the one copy of the background removal
 * model. Engine and preview workers send it square images through their own MessagePort and get
 * masks back. Runs happen one at a time, on WebGPU when the browser has it and on WebAssembly
 * otherwise. Hexlode serves ONNX Runtime's WebAssembly with the app, and loads the smaller build
 * without WebGPU on devices that cannot use it.
 */

import webgpuWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url'
import wasmOnlyUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'

import { BACKGROUND_MODEL } from '#/features/background-removal/constants'
import {
  preferredBackend,
  type Segmentation,
  startSegmentation,
} from '#/features/background-removal/inference-session'
import { readStoredModel } from '#/features/background-removal/model-files'
import type { InferenceBackend } from '#/features/background-removal/types'
import { ModelMissingError } from '#/features/background-removal/types'
import {
  type InferenceReport,
  inferenceControlSchema,
  type SegmentResponse,
  segmentRequestSchema,
} from '#/features/background-removal/validators'

const scope = self as unknown as DedicatedWorkerGlobalScope
const report = (message: InferenceReport) => scope.postMessage(message)

/** ONNX Runtime for a backend, from Hexlode's own files. */
async function runtime(backend: InferenceBackend) {
  const ort =
    backend === 'webgpu'
      ? await import('onnxruntime-web/webgpu')
      : await import('onnxruntime-web/wasm')
  ort.env.wasm.wasmPaths = { wasm: backend === 'webgpu' ? webgpuWasmUrl : wasmOnlyUrl }
  // More threads need cross-origin isolation, which Hexlode does not turn on.
  ort.env.wasm.numThreads = 1
  ort.env.wasm.proxy = false
  return ort
}

let segmentation: Promise<Segmentation> | undefined
let queue: Promise<unknown> = Promise.resolve()

async function start() {
  const bytes = await readStoredModel(BACKGROUND_MODEL)
  if (!bytes) throw new ModelMissingError()
  const started = performance.now()
  const backend = await preferredBackend()
  let session: Segmentation
  try {
    session = await startSegmentation(await runtime(backend), bytes, BACKGROUND_MODEL, backend)
  } catch (reason) {
    // A GPU that cannot run the model, such as one without enough memory, falls back.
    if (backend === 'wasm') throw reason
    session = await startSegmentation(await runtime('wasm'), bytes, BACKGROUND_MODEL, 'wasm')
  }
  report({ type: 'started', backend: session.backend, ms: performance.now() - started })
  return session
}

function errorCode(reason: unknown) {
  if (reason instanceof ModelMissingError) return reason.code
  return 'inference_failed'
}

function serve(port: MessagePort) {
  port.onmessage = (event: MessageEvent<unknown>) => {
    const parsed = segmentRequestSchema.safeParse(event.data)
    if (!parsed.success) return
    const request = parsed.data
    queue = queue.then(async () => {
      let response: SegmentResponse
      try {
        segmentation ??= start()
        const session = await segmentation
        const started = performance.now()
        const mask = await session.run(request)
        report({ type: 'ran', backend: session.backend, ms: performance.now() - started })
        response = { type: 'mask', id: request.id, mask }
      } catch (reason) {
        // The next request tries again, for example once the model has been downloaded.
        segmentation = undefined
        const code = errorCode(reason)
        report({ type: 'failed', code })
        response = {
          type: 'error',
          id: request.id,
          code,
          message: reason instanceof Error ? reason.message : 'Background removal failed.',
        }
      }
      port.postMessage(response, response.type === 'mask' ? [response.mask.buffer] : [])
    })
  }
}

scope.onmessage = (event: MessageEvent<unknown>) => {
  const parsed = inferenceControlSchema.safeParse(event.data)
  if (parsed.success) serve(parsed.data.port)
}

report({ type: 'ready' })

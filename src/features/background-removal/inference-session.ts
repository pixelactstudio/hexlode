/**
 * One ONNX Runtime session for a segmentation model: start it on a backend and turn a square
 * image into a mask. Takes the runtime as an argument, so the inference worker passes the browser
 * build and the model quality suite passes the same package in Node.
 */
import type * as Ort from 'onnxruntime-web'

import { ADAPTER_TIMEOUT_MS } from '#/features/background-removal/constants'
import { logitsToMask, toModelInput } from '#/features/background-removal/mask'
import type { InferenceBackend, SegmentationModel } from '#/features/background-removal/types'
import type { Pixels } from '#/features/images/types'

type Runtime = Pick<typeof Ort, 'InferenceSession' | 'Tensor'>

export interface Segmentation {
  backend: InferenceBackend
  run(pixels: Pixels): Promise<Uint8Array>
  release(): Promise<void>
}

export async function startSegmentation(
  ort: Runtime,
  bytes: Uint8Array,
  model: SegmentationModel,
  backend: InferenceBackend,
): Promise<Segmentation> {
  const session = await ort.InferenceSession.create(bytes, {
    executionProviders: [backend],
    graphOptimizationLevel: 'all',
  })
  const output = session.outputNames[0]
  const size = model.inputSize
  return {
    backend,
    async run(pixels) {
      if (pixels.width !== size || pixels.height !== size) {
        throw new Error(`The model takes ${size} × ${size} images.`)
      }
      const input = new ort.Tensor('float32', toModelInput(pixels, model), [1, 3, size, size])
      const results = await session.run({ [model.inputName]: input })
      const logits = results[output]
      try {
        if (logits.type !== 'float32') throw new Error(`Unexpected model output: ${logits.type}.`)
        return logitsToMask(logits.data as Float32Array)
      } finally {
        input.dispose()
        logits.dispose()
      }
    },
    release: () => session.release(),
  }
}

/**
 * WebGPU when this browser has an adapter for it, WebAssembly otherwise. Some browsers take long
 * to answer without a usable GPU, so no answer within `timeoutMs` means WebAssembly.
 */
export async function preferredBackend(timeoutMs = ADAPTER_TIMEOUT_MS): Promise<InferenceBackend> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
  if (!gpu) return 'wasm'
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))
  try {
    return (await Promise.race([gpu.requestAdapter(), timeout])) ? 'webgpu' : 'wasm'
  } catch {
    return 'wasm'
  }
}

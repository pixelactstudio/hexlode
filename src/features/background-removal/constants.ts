import type { SegmentationModel } from '#/features/background-removal/types'

/**
 * BiRefNet_lite exported to ONNX at 512 × 512 in half precision (ADR 0017). Hexlode's server
 * fetches this exact file once from the pinned revision, checks its hash and serves it from
 * `/models/`; the browser checks the hash again before keeping it.
 */
export const BACKGROUND_MODEL: SegmentationModel = {
  id: 'birefnet-lite-512',
  file: 'birefnet-lite-512-fp16-eff9216b.onnx',
  bytes: 98_484_532,
  sha256: 'eff9216bb2f9d3f023d9c2b7196845a7485739ab1f231593633e4d2344ffc516',
  upstream:
    'https://huggingface.co/studioludens/birefnet-lite-512/resolve/962e67969ec6acec9c19fab76acee4f5e22e990c/onnx/model_fp16.onnx',
  inputName: 'input_image',
  inputSize: 512,
  mean: [0.485, 0.456, 0.406],
  std: [0.229, 0.224, 0.225],
}

/** How the app names and credits the model. */
export const MODEL_CREDIT = 'BiRefNet_lite (MIT licence), by Peng Zheng and others'

/** Every on-device model, by ID, as nodes name them in `models`. */
export const ON_DEVICE_MODELS: Record<string, SegmentationModel> = {
  [BACKGROUND_MODEL.id]: BACKGROUND_MODEL,
}

/**
 * ONNX Runtime's WebAssembly, served with the app and downloaded the first time a model runs: the
 * build with WebGPU, or the smaller one for devices without it.
 */
export const RUNTIME_BYTES = { webgpu: 28_747_738, wasm: 14_848_852 } as const

/** Where models are served from, on Hexlode's own server. */
export const MODEL_PATH_PREFIX = '/models/'

/** The Cache Storage cache that keeps downloaded models in the browser. */
export const MODEL_CACHE_NAME = 'hexlode-models'

/**
 * Mask values at or below this become fully transparent and at or above `MASK_OPAQUE` fully
 * opaque, so the background has no faint haze that would stop Auto-trim and the subject has no
 * see-through spots.
 */
export const MASK_CLEAR = 8
export const MASK_OPAQUE = 247

/**
 * Box sizes, in pixels of the full image, of the two passes that estimate the subject's own colour
 * at its soft edges, so a cut-out keeps no fringe of the old background (approximate fast
 * foreground colour estimation, Forte and Pitié 2021). The large pass reaches into the subject;
 * the small one keeps detail. BiRefNet's own code uses the same two sizes.
 */
export const FOREGROUND_BLUR_SIZES = [90, 6] as const

/**
 * Rough timings for estimates before this device has run the model. A run on WebAssembly uses
 * one thread, because more need cross-origin isolation, which Hexlode does not turn on.
 */
export const MODEL_RUN_MS = { webgpu: 900, wasm: 9000 } as const
/** Reading the model and preparing it for the backend, once per page. */
export const MODEL_START_MS = { webgpu: 4000, wasm: 8000 } as const
/** Download speed assumed for the one-time model download. */
export const ASSUMED_DOWNLOAD_BYTES_PER_SECOND = 5_000_000

/** How long to wait for a WebGPU adapter before using WebAssembly. */
export const ADAPTER_TIMEOUT_MS = 3000

/** Cutting out the subject after the model ran: mask scaling and colour estimation. */
export const CUT_OUT_MS_PER_MEGAPIXEL = 60

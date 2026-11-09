import type { Pixels } from '#/features/images/types'

/** A pinned segmentation model: one ONNX file and how to feed it. */
export interface SegmentationModel {
  id: string
  /** The file name under `/models/`. Includes part of the hash, so a new file gets a new name. */
  file: string
  bytes: number
  sha256: string
  /** The pinned source Hexlode's server fetches the file from once. */
  upstream: string
  inputName: string
  /** The model takes a square RGB image of this many pixels a side. */
  inputSize: number
  /** Per-channel normalisation of values from 0 to 1. */
  mean: readonly [number, number, number]
  std: readonly [number, number, number]
}

/** Where a model ran: the GPU through WebGPU, or the CPU through WebAssembly. */
export type InferenceBackend = 'webgpu' | 'wasm'

/** What a node calls to find the subject of an image. */
export interface Segmenter {
  /** Side of the square image `segment` takes. */
  inputSize: number
  /** The subject mask of a square image, one byte per pixel from 0 (background) to 255. */
  segment(pixels: Pixels, signal?: AbortSignal): Promise<Uint8Array>
}

/** Thrown when a node needs a model that is not in this browser yet. */
export class ModelMissingError extends Error {
  readonly code = 'model_missing'
  constructor() {
    super('The background removal model is not downloaded yet.')
    this.name = 'ModelMissingError'
  }
}

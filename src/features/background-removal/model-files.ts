/**
 * Models in this browser. A model downloads once, from Hexlode's own server, after the person
 * agreed; its SHA-256 is checked before it is kept in Cache Storage, where the page and every
 * worker can read it. Nothing here runs without being asked.
 */
import { MODEL_CACHE_NAME, MODEL_PATH_PREFIX } from '#/features/background-removal/constants'
import type { SegmentationModel } from '#/features/background-removal/types'

type ModelFile = Pick<SegmentationModel, 'file' | 'bytes' | 'sha256'>

export class ModelDownloadError extends Error {
  constructor(
    readonly code: 'http_error' | 'size_mismatch' | 'hash_mismatch' | 'storage_failed',
    message: string,
  ) {
    super(message)
    this.name = 'ModelDownloadError'
  }
}

/** Where Hexlode's server serves the model, and the key it is kept under in this browser. */
export function modelUrl(model: Pick<SegmentationModel, 'file'>) {
  return `${MODEL_PATH_PREFIX}${model.file}`
}

function modelCache() {
  if (typeof caches === 'undefined') return null
  return caches.open(MODEL_CACHE_NAME)
}

export async function hasStoredModel(model: ModelFile) {
  const cache = await modelCache()
  return Boolean(await cache?.match(modelUrl(model)))
}

/** The kept model file, or null when it was never downloaded or site data was cleared. */
export async function readStoredModel(model: ModelFile) {
  const response = await (await modelCache())?.match(modelUrl(model))
  if (!response) return null
  return new Uint8Array(await response.arrayBuffer())
}

export async function deleteStoredModel(model: ModelFile) {
  await (await modelCache())?.delete(modelUrl(model))
}

export interface DownloadOptions {
  signal?: AbortSignal
  /** Bytes received so far, out of the model's size. */
  onProgress?: (received: number, total: number) => void
  /** Where to fetch from. Hexlode's own server unless a test serves a fixture. */
  from?: string
}

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Downloads the model, checks it and keeps it. Resolves to how long it took. */
export async function downloadModel(model: ModelFile, options: DownloadOptions = {}) {
  const started = performance.now()
  const response = await fetch(options.from ?? modelUrl(model), { signal: options.signal })
  if (!response.ok || !response.body) {
    throw new ModelDownloadError(
      'http_error',
      `The model could not be downloaded (${response.status}).`,
    )
  }
  const bytes = new Uint8Array(model.bytes)
  let received = 0
  const reader = response.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (received + value.byteLength > model.bytes) {
      await reader.cancel()
      throw new ModelDownloadError('size_mismatch', 'The downloaded model is larger than expected.')
    }
    bytes.set(value, received)
    received += value.byteLength
    options.onProgress?.(received, model.bytes)
  }
  if (received !== model.bytes) {
    throw new ModelDownloadError('size_mismatch', 'The model download was incomplete.')
  }
  if ((await sha256(bytes)) !== model.sha256) {
    throw new ModelDownloadError(
      'hash_mismatch',
      'The downloaded model did not match its checksum.',
    )
  }
  try {
    const cache = await modelCache()
    if (!cache) throw new Error('Cache Storage is not available.')
    await cache.put(
      modelUrl(model),
      new Response(bytes, {
        headers: {
          'content-type': 'application/octet-stream',
          'content-length': String(model.bytes),
        },
      }),
    )
  } catch {
    throw new ModelDownloadError(
      'storage_failed',
      'The model could not be kept in this browser. Free some space and try again.',
    )
  }
  return { bytes: model.bytes, ms: performance.now() - started }
}

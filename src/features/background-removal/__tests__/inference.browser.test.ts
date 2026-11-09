/**
 * The model download and the shared inference worker, with ONNX Runtime running a tiny stand-in
 * model (`threshold.onnx`) that has the real model's input and output and sees bright pixels as
 * the subject. It is kept under the real model's name, so the worker loads it as it would the
 * real one.
 */
import { afterEach, describe, expect, it } from 'vitest'

import { BACKGROUND_MODEL } from '#/features/background-removal/constants'
import {
  createInferenceHost,
  createInferenceWorker,
} from '#/features/background-removal/inference-host'
import {
  deleteStoredModel,
  downloadModel,
  hasStoredModel,
  ModelDownloadError,
  readStoredModel,
} from '#/features/background-removal/model-files'
import { createSegmenterClient } from '#/features/background-removal/segmenter-client'

import { STAND_IN_MODEL, STAND_IN_MODEL_URL } from './stand-in-model'

const FIXTURE = STAND_IN_MODEL_URL
const THRESHOLD_BYTES = STAND_IN_MODEL.bytes
const standIn = STAND_IN_MODEL

/** A white square on black, at the model's input size. */
function square(size = BACKGROUND_MODEL.inputSize) {
  const data = new Uint8ClampedArray(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const inside = x >= size / 4 && x < (size * 3) / 4 && y >= size / 4 && y < (size * 3) / 4
      data.set(inside ? [255, 255, 255, 255] : [0, 0, 0, 255], (y * size + x) * 4)
    }
  }
  return { data, width: size, height: size }
}

const hosts: ReturnType<typeof createInferenceHost>[] = []
function host() {
  const created = createInferenceHost(createInferenceWorker)
  hosts.push(created)
  return created
}

afterEach(async () => {
  for (const created of hosts.splice(0)) created.dispose()
  await deleteStoredModel(BACKGROUND_MODEL)
})

describe('downloadModel', () => {
  it('keeps the model once its size and hash match, reporting progress', async () => {
    const progress: number[] = []
    const result = await downloadModel(standIn, {
      from: FIXTURE,
      onProgress: (received, total) => progress.push(received / total),
    })
    expect(result.bytes).toBe(THRESHOLD_BYTES)
    expect(progress.at(-1)).toBe(1)
    expect(await hasStoredModel(BACKGROUND_MODEL)).toBe(true)
    expect(await readStoredModel(BACKGROUND_MODEL)).toHaveLength(THRESHOLD_BYTES)
  })

  it('keeps nothing when the hash does not match', async () => {
    const tampered = { ...standIn, sha256: '0'.repeat(64) }
    const failure = await downloadModel(tampered, { from: FIXTURE }).catch((reason) => reason)
    expect(failure).toBeInstanceOf(ModelDownloadError)
    expect(failure.code).toBe('hash_mismatch')
    expect(await hasStoredModel(BACKGROUND_MODEL)).toBe(false)
  })

  it('keeps nothing when the file has a different size', async () => {
    const failure = await downloadModel({ ...standIn, bytes: 400 }, { from: FIXTURE }).catch(
      (reason) => reason,
    )
    expect(failure.code).toBe('size_mismatch')
    expect(await hasStoredModel(BACKGROUND_MODEL)).toBe(false)
  })
})

describe('the inference worker', () => {
  it('finds the subject with the model kept in this browser', async () => {
    await downloadModel(standIn, { from: FIXTURE })
    const inference = host()
    const mask = await createSegmenterClient(inference.connect()).segment(square())
    const size = BACKGROUND_MODEL.inputSize
    expect(mask).toHaveLength(size * size)
    expect(mask[0]).toBe(0)
    expect(mask[(size / 2) * size + size / 2]).toBe(255)
    expect(mask[(size / 2) * size + size / 8]).toBe(0)
    expect(inference.stats()).toMatchObject({ backend: 'wasm', runs: 1 })
    expect(inference.stats().startMs).toBeGreaterThan(0)
  })

  it('serves several workers with one copy of the model', async () => {
    await downloadModel(standIn, { from: FIXTURE })
    const inference = host()
    const clients = [
      createSegmenterClient(inference.connect()),
      createSegmenterClient(inference.connect()),
    ]
    const masks = await Promise.all(
      clients.flatMap((client) => [client.segment(square()), client.segment(square())]),
    )
    expect(masks.every((mask) => mask[0] === 0 && mask[mask.length / 2 + 256] === 255)).toBe(true)
    const { runs } = inference.takeStats()
    expect(runs).toBe(4)
    expect(inference.takeStats().runs).toBe(0)
  })

  it('answers with an error instead of hanging when its script cannot load', async () => {
    const broken = createInferenceHost(
      () => new Worker(new URL('/missing-inference.worker.js', location.href), { type: 'module' }),
    )
    hosts.push(broken)
    const client = createSegmenterClient(broken.connect())
    await expect(client.segment(square())).rejects.toThrow(
      'Hexlode could not start background removal. Check your connection and reload the page.',
    )
    expect(broken.stats().failureCodes).toEqual(['inference_unavailable'])
  })

  it('says the model is missing until it is downloaded, then runs', async () => {
    const inference = host()
    const client = createSegmenterClient(inference.connect())
    await expect(client.segment(square())).rejects.toThrow(
      'The background removal model is not downloaded yet.',
    )
    expect(inference.stats().failureCodes).toEqual(['model_missing'])
    await downloadModel(standIn, { from: FIXTURE })
    expect((await client.segment(square()))[0]).toBe(0)
  })
})

/**
 * The real background removal model on licensed photos whose true subject is known (see
 * fixtures/SOURCES.md). Opt-in: `pnpm test:model`. The model is 94 MB and a run needs about
 * 2.5 GB of memory, so this suite stays out of `pnpm validate`. The first run fetches the pinned
 * model through the same server code that serves it to browsers, into `HEXLODE_MODEL_DIR` or the
 * system's temporary folder, and later runs reuse it.
 *
 * The photos go through the node's own code: resized to the model's input, run on ONNX Runtime's
 * WebAssembly backend, the mask scaled back and the subject cut out with its edge colours
 * estimated. The cut-out must match the reference mask by intersection over union, and on white
 * its edges must be close to the reference subject on white.
 */
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import * as ort from 'onnxruntime-web'
import { beforeAll, describe, expect, it } from 'vitest'

import { BACKGROUND_MODEL } from '#/features/background-removal/constants'
import {
  type Segmentation,
  startSegmentation,
} from '#/features/background-removal/inference-session'
import { cutOut, scaleMask } from '#/features/background-removal/mask'
import { createModelServer, modelDirectory } from '#/features/background-removal/model-server'
import type { Pixels } from '#/features/images/types'

/**
 * Lowest intersection over union per photo: about one point under what the pinned model reached
 * (0.9970, 0.9948, 0.9608, 0.8765 and 0.9833), so a change that makes masks worse fails. The
 * suitcase loses points to lamps behind it that the model keeps; the cat, to its thin legs.
 */
const MIN_IOU: Record<string, number> = {
  emac: 0.99,
  daruma: 0.985,
  luggage: 0.95,
  cat: 0.865,
  woman: 0.97,
}
/**
 * Mean colour difference on white from the reference subject where its edge is soft, out of 255,
 * over every photo. The pinned model reached 30.9, and 35.2 without colour estimation.
 */
const MAX_EDGE_ERROR = 33
const edges: { estimated: number; plain: number }[] = []

globalThis.ImageData ??= class {
  constructor(
    readonly data: Uint8ClampedArray,
    readonly width: number,
    readonly height: number,
  ) {}
} as unknown as typeof ImageData

const resolve = createRequire(import.meta.url).resolve
const wasm = async (path: string) => WebAssembly.compile(await readFile(resolve(path)))
const fixture = (name: string) => readFile(new URL(`./fixtures/${name}`, import.meta.url))

let segmentation: Segmentation
let codecs: {
  jpeg(bytes: Uint8Array): Promise<Pixels>
  png(bytes: Uint8Array): Promise<Pixels>
  resize(pixels: Pixels, width: number, height: number): Promise<Pixels>
}

beforeAll(async () => {
  const jpeg = await import('@jsquash/jpeg/decode.js')
  await jpeg.init(await wasm('@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm'))
  const png = await import('@jsquash/png/decode.js')
  await png.init(await wasm('@jsquash/png/codec/pkg/squoosh_png_bg.wasm'))
  const resizer = await import('@jsquash/resize')
  await resizer.initResize(await wasm('@jsquash/resize/lib/resize/pkg/squoosh_resize_bg.wasm'))
  codecs = {
    jpeg: async (bytes) => (await jpeg.default(bytes.slice().buffer)) as Pixels,
    png: async (bytes) => (await png.default(bytes.slice().buffer)) as Pixels,
    // The node resizes with the triangle filter too.
    resize: async (pixels, width, height) =>
      (await resizer.default(pixels as ImageData, { width, height, method: 'triangle' })) as Pixels,
  }
  const server = createModelServer({ directory: modelDirectory(), models: [BACKGROUND_MODEL] })
  const response = await server.respond(
    BACKGROUND_MODEL.file,
    new Request(`http://hexlode.test/models/${BACKGROUND_MODEL.file}`),
  )
  expect(response.status).toBe(200)
  const bytes = new Uint8Array(await response.arrayBuffer())
  ort.env.wasm.numThreads = 1
  segmentation = await startSegmentation(ort, bytes, BACKGROUND_MODEL, 'wasm')
}, 15 * 60_000)

function intersectionOverUnion(alpha: (index: number) => number, reference: Pixels) {
  let intersection = 0
  let union = 0
  for (let index = 0; index < reference.width * reference.height; index += 1) {
    const predicted = alpha(index) >= 128
    const actual = reference.data[index * 4] >= 128
    if (predicted && actual) intersection += 1
    if (predicted || actual) union += 1
  }
  return intersection / union
}

/**
 * Mean difference on white where the true edge is soft, such as hair and fur: where a fringe of
 * the old scene would show. Places the model got wrong count against the IoU instead.
 */
function edgeError(cut: Pixels, onWhite: Pixels, reference: Pixels) {
  let total = 0
  let count = 0
  for (let index = 0; index < cut.width * cut.height; index += 1) {
    const alpha = cut.data[index * 4 + 3]
    const expected = reference.data[index * 4]
    if (expected < 16 || expected > 240) continue
    for (let channel = 0; channel < 3; channel += 1) {
      const colour = (cut.data[index * 4 + channel] * alpha + 255 * (255 - alpha)) / 255
      total += Math.abs(colour - onWhite.data[index * 4 + channel])
    }
    count += 3
  }
  return total / Math.max(1, count)
}

describe('the background removal model', () => {
  it.each(Object.keys(MIN_IOU))('cuts out %s', async (name) => {
    const photo = await codecs.jpeg(await fixture(`${name}.jpg`))
    const reference = await codecs.png(await fixture(`${name}-mask.png`))
    const onWhite = await codecs.jpeg(await fixture(`${name}-white.jpg`))
    const size = BACKGROUND_MODEL.inputSize
    const mask = await segmentation.run(await codecs.resize(photo, size, size))
    const cut = cutOut(photo, scaleMask(mask, size, photo.width, photo.height))
    const iou = intersectionOverUnion((index) => cut.data[index * 4 + 3], reference)
    const plain = { ...cut, data: new Uint8ClampedArray(photo.data) }
    for (let index = 3; index < plain.data.length; index += 4) plain.data[index] = cut.data[index]
    const edge = {
      estimated: edgeError(cut, onWhite, reference),
      plain: edgeError(plain, onWhite, reference),
    }
    edges.push(edge)
    console.info(
      `${name}: IoU ${iou.toFixed(4)}, edge error ${edge.estimated.toFixed(2)} (${edge.plain.toFixed(2)} without colour estimation)`,
    )
    expect(iou).toBeGreaterThanOrEqual(MIN_IOU[name])
  })

  it('leaves no fringe of the old background on soft edges', () => {
    expect(edges).toHaveLength(Object.keys(MIN_IOU).length)
    const mean = (key: 'estimated' | 'plain') =>
      edges.reduce((sum, edge) => sum + edge[key], 0) / edges.length
    expect(mean('estimated')).toBeLessThanOrEqual(MAX_EDGE_ERROR)
    // Taking the old background out of the edge colours is what makes them clean on white.
    expect(mean('estimated')).toBeLessThan(mean('plain') * 0.95)
  })
})

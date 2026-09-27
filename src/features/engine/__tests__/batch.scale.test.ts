/**
 * Exit gate: a batch of 500 generated 12-megapixel images completes, and the browser's memory
 * does not grow with batch size. Runs the Web-ready photos template on the real worker pool with
 * the OPFS step cache. Run with `pnpm test:scale`.
 */
import { expect, it } from 'vitest'
import { commands } from 'vitest/browser'

import { GIGABYTE } from '#/features/engine/constants'
import { appDirectory, listNames } from '#/features/engine/opfs/files'
import { createStepCacheIndex } from '#/features/engine/opfs/step-cache'
import { createWorkerPoolHost } from '#/features/engine/pool-host'
import { choosePoolSize, deviceProfile } from '#/features/engine/pool-size'
import { runPipeline } from '#/features/engine/runner'
import { jsquashCodecs } from '#/features/images/codecs'
import { decodeFile, unzip } from '#/features/nodes/__tests__/harness'
import { productRegistry } from '#/features/nodes/registry'
import { TEMPLATES } from '#/features/pipelines/templates'
import { prepareSources } from '#/features/runs/sources'

declare module 'vitest/internal/browser' {
  interface BrowserCommands {
    browserMemory: () => Promise<{ rssBytes: number; processes: number } | null>
    writeReport: (name: string, report: unknown) => Promise<string>
  }
}

const COUNT = 500
const WIDTH = 4000
const HEIGHT = 3000
const MEGABYTE = 1024 ** 2
/** Growth allowed between item 100 and item 500. Each 12 MP image decodes to 46 MB. */
const ALLOWED_GROWTH_BYTES = 300 * MEGABYTE

async function twelveMegapixelJpeg() {
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4)
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const offset = (y * WIDTH + x) * 4
      data[offset] = (x * 255) / WIDTH
      data[offset + 1] = (y * 255) / HEIGHT
      data[offset + 2] = 128
      data[offset + 3] = 255
    }
  }
  return jsquashCodecs.encode(
    { format: 'jpeg', options: { quality: 75, progressive: false, chromaSubsampling: '420' } },
    { data, width: WIDTH, height: HEIGHT },
  )
}

/** A distinct file per index: the same image with a numbered comment segment. */
function numbered(jpeg: Uint8Array, index: number) {
  const text = new TextEncoder().encode(`hexlode test image ${index}`)
  const segment = new Uint8Array(4 + text.length)
  segment.set([0xff, 0xfe, (text.length + 2) >> 8, (text.length + 2) & 0xff])
  segment.set(text, 4)
  const parts = [jpeg.slice(0, 2), segment, jpeg.slice(2)] as Uint8Array<ArrayBuffer>[]
  return new File(parts, `photo-${index}.jpg`, {
    type: 'image/jpeg',
    lastModified: 1_700_000_000_000 + index,
  })
}

it(`runs ${COUNT} images of 12 megapixels without memory growing with the batch`, async () => {
  const root = await appDirectory()
  for (const name of await listNames(root)) await root.removeEntry(name, { recursive: true })

  const jpeg = await twelveMegapixelJpeg()
  const inputs = Array.from({ length: COUNT }, (_, index) => {
    const file = numbered(jpeg, index)
    return { file, relativePath: file.name }
  })
  const pipeline = TEMPLATES.find((template) => template.id === 'web-ready-photos')?.pipeline
  if (!pipeline) throw new Error('Missing template')
  const { sources, refused } = await prepareSources(inputs, new Set(['image:jpeg']))
  expect(refused).toEqual([])

  const workers = choosePoolSize(deviceProfile(WIDTH * HEIGHT * 4))
  const index = await createStepCacheIndex(root, 0.25 * GIGABYTE)
  const host = createWorkerPoolHost({
    size: workers,
    index,
    createWorker: () =>
      new Worker(new URL('../engine.worker.ts', import.meta.url), { type: 'module' }),
  })

  const samples: Record<number, Promise<{ rssBytes: number } | null>> = {}
  let finished = 0
  let failed = 0
  const started = performance.now()
  const result = await runPipeline({
    pipeline,
    registry: productRegistry,
    sources,
    host,
    onEvent: (event) => {
      if (event.type === 'node-item' && event.status === 'failed') failed += 1
      if (event.type !== 'item-finished') return
      finished += 1
      if (finished === 100 || finished === COUNT) samples[finished] = commands.browserMemory()
    },
  })
  const seconds = (performance.now() - started) / 1000
  host.dispose()

  expect(result.status).toBe('complete')
  expect(failed).toBe(0)
  const [delivery] = result.deliveries
  expect(delivery.files).toHaveLength(COUNT)
  const entries = await unzip(delivery.archive as Blob)
  expect(entries).toHaveLength(COUNT)
  expect(await decodeFile(entries[COUNT - 1].bytes)).toMatchObject({
    format: 'webp',
    width: 2048,
    height: 1536,
  })

  const early = await samples[100]
  const late = await samples[COUNT]
  const report = {
    images: COUNT,
    seconds: Math.round(seconds),
    workers,
    memoryAfter100Mb: early ? Math.round(early.rssBytes / MEGABYTE) : null,
    memoryAfterAllMb: late ? Math.round(late.rssBytes / MEGABYTE) : null,
    stepCacheMb: Math.round(index.usedBytes() / MEGABYTE),
  }
  await commands.writeReport('batch-500', report)
  console.log(
    `${COUNT} images in ${seconds.toFixed(0)} s on ${workers} workers. Browser memory after 100: ${
      early ? Math.round(early.rssBytes / MEGABYTE) : '?'
    } MB, after ${COUNT}: ${late ? Math.round(late.rssBytes / MEGABYTE) : '?'} MB. Step cache: ${Math.round(index.usedBytes() / MEGABYTE)} MB.`,
  )
  if (early && late) expect(late.rssBytes - early.rssBytes).toBeLessThan(ALLOWED_GROWTH_BYTES)
  expect(index.usedBytes()).toBeLessThanOrEqual(0.25 * GIGABYTE)
})

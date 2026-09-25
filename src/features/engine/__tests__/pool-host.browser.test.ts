import { beforeEach, describe, expect, it } from 'vitest'

import { fileKey } from '#/features/engine/keys'
import { appDirectory, listNames } from '#/features/engine/opfs/files'
import { createStepCacheIndex } from '#/features/engine/opfs/step-cache'
import { createWorkerPoolHost } from '#/features/engine/pool-host'
import { runPipeline, type SourceItem } from '#/features/engine/runner'
import type { Pipeline, RunEvent } from '#/features/engine/types'
import { loadImageItem } from '#/features/images/image-item'
import {
  ALL_FORMAT_FIXTURES,
  chain,
  decodeFile,
  fixtureBytes,
  unzip,
} from '#/features/nodes/__tests__/harness'
import { productRegistry } from '#/features/nodes/registry'

const createWorker = () =>
  new Worker(new URL('../engine.worker.ts', import.meta.url), { type: 'module' })

async function sources(names: string[]): Promise<SourceItem[]> {
  return Promise.all(
    names.map(async (name, index) => {
      const bytes = await fixtureBytes(name)
      const file = new File([bytes], name, { lastModified: 1_000 + index })
      return { index, key: fileKey(file), meta: (await loadImageItem(bytes, name)).meta, file }
    }),
  )
}

async function run(
  pipeline: Pipeline,
  host: ReturnType<typeof createWorkerPoolHost>,
  names: string[],
  signal?: AbortSignal,
  onEvent?: (event: RunEvent) => void,
) {
  const events: RunEvent[] = []
  const result = await runPipeline({
    pipeline,
    registry: productRegistry,
    sources: await sources(names),
    host,
    signal,
    onEvent: (event) => {
      events.push(event)
      onEvent?.(event)
    },
  })
  const statuses = (nodeId: string) =>
    events.flatMap((event) =>
      event.type === 'node-item' && event.nodeId === nodeId ? [event.status] : [],
    )
  return { result, events, statuses }
}

describe('worker pool', () => {
  beforeEach(async () => {
    const root = await appDirectory()
    for (const name of await listNames(root)) await root.removeEntry(name, { recursive: true })
  })

  it('runs items in workers and delivers a ZIP backed by OPFS', async () => {
    const host = createWorkerPoolHost({ size: 2, createWorker, index: null })
    const { result } = await run(chain(['convert', { format: 'png' }]), host, ALL_FORMAT_FIXTURES)
    host.dispose()
    expect(result.status).toBe('complete')
    const archive = result.deliveries[0].archive as Blob
    const entries = await unzip(archive)
    expect(entries.map(({ name }) => name).sort()).toEqual(
      [
        'photo.png',
        'photo-2.png',
        'photo-3.png',
        'photo-4.png',
        'photo-5.png',
        'photo-6.png',
      ].sort(),
    )
    for (const entry of entries) {
      expect(await decodeFile(entry.bytes)).toMatchObject({ format: 'png', width: 48, height: 32 })
    }
  })

  it('runs only the changed node and the nodes after it on the next run', async () => {
    const root = await appDirectory()
    const index = await createStepCacheIndex(root, 1024 ** 3)
    const host = createWorkerPoolHost({ size: 2, createWorker, index })
    const pipeline = (quality: number) =>
      chain(
        ['rotate', { auto: true }],
        ['resize', { mode: 'percent', percent: 50 }],
        ['strip-metadata', { mode: 'copyright' }],
        ['convert', { format: 'webp', webp: { quality } }],
      )
    const first = await run(pipeline(80), host, ['photo.jpg', 'oriented.jpg'])
    expect(first.statuses('resize-2')).toEqual(['processed', 'processed'])
    const second = await run(pipeline(40), host, ['photo.jpg', 'oriented.jpg'])
    host.dispose()
    expect(second.statuses('rotate-1')).toEqual(['cached', 'cached'])
    expect(second.statuses('resize-2')).toEqual(['cached', 'cached'])
    expect(second.statuses('strip-metadata-3')).toEqual(['cached', 'cached'])
    expect(second.statuses('convert-4')).toEqual(['processed', 'processed'])
    const entries = await unzip(second.result.deliveries[0].archive as Blob)
    const upright = entries.find(({ name }) => name === 'oriented.webp') as { bytes: Uint8Array }
    expect(await decodeFile(upright.bytes)).toMatchObject({ format: 'webp', width: 16, height: 24 })
  })

  it('cancels a run and keeps the items already finished', async () => {
    const controller = new AbortController()
    const host = createWorkerPoolHost({ size: 1, createWorker, index: null })
    const { result } = await run(
      chain(['convert', { format: 'avif' }]),
      host,
      ALL_FORMAT_FIXTURES,
      controller.signal,
      (event) => {
        if (event.type === 'item-finished') controller.abort()
      },
    )
    host.dispose()
    expect(result.status).toBe('cancelled')
    expect(result.deliveries[0].files.length).toBeGreaterThanOrEqual(1)
    expect(result.deliveries[0].files.length).toBeLessThan(6)
  })
})

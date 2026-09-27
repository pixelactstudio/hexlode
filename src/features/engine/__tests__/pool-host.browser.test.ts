import { beforeEach, describe, expect, it } from 'vitest'

import { estimateRun } from '#/features/engine/estimate'
import { fileKey } from '#/features/engine/keys'
import { appDirectory, directoryAt, listNames } from '#/features/engine/opfs/files'
import { clearRuns } from '#/features/engine/opfs/run-stores'
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

/** A worker whose script cannot load, as when the dev server is down. */
const createBrokenWorker =
  (loadFailed: Promise<unknown>[] = []) =>
  () => {
    const worker = new Worker(new URL('/missing-engine.worker.js', location.href), {
      type: 'module',
    })
    loadFailed.push(new Promise((resolve) => worker.addEventListener('error', resolve)))
    return worker
  }

const LOAD_FAILED =
  'Hexlode could not start its image engine. Check your connection and reload the page.'

function settlesWithin<T>(promise: Promise<T>, ms = 5_000) {
  return Promise.race([
    promise.then(
      (value) => ({ settled: 'resolved' as const, value }),
      (reason: unknown) => ({ settled: 'rejected' as const, reason }),
    ),
    new Promise<{ settled: 'hung' }>((resolve) =>
      setTimeout(() => resolve({ settled: 'hung' }), ms),
    ),
  ])
}

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
    const estimate = estimateRun({
      pipeline: pipeline(40),
      registry: productRegistry,
      sources: await sources(['photo.jpg', 'oriented.jpg']),
      workers: 2,
      lookup: index.entry,
    })
    expect(estimate).toMatchObject({ cached: 6, encodes: 2 })
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

  it('fails work with the reason when a worker cannot set up the run', async () => {
    const host = createWorkerPoolHost({ size: 1, createWorker, index: null })
    await host.begin({
      runId: 'unknown-node',
      pipeline: chain(['no-such-node']),
      plan: undefined as never,
    })
    const [source] = await sources(['photo.jpg'])
    const outcome = await settlesWithin(
      host.runSource(source, () => {}, new AbortController().signal),
    )
    host.dispose()
    expect(outcome).toMatchObject({
      settled: 'rejected',
      reason: new Error('Unknown node type: no-such-node'),
    })
  })

  it('keeps the files of a run still going in another tab', async () => {
    const pipeline = chain(['convert', { format: 'png' }])
    const [source] = await sources(['photo.jpg'])
    const otherTab = createWorkerPoolHost({ size: 1, createWorker, index: null })
    await otherTab.begin({ runId: 'other-tab', pipeline, plan: undefined as never })
    await otherTab.runSource(source, () => {}, new AbortController().signal)
    const thisTab = createWorkerPoolHost({ size: 1, createWorker, index: null })
    await thisTab.begin({ runId: 'this-tab', pipeline, plan: undefined as never })
    await clearRuns(await appDirectory())
    const outcome = await settlesWithin(otherTab.deliver('out'))
    otherTab.dispose()
    thisTab.dispose()
    expect(outcome.settled).toBe('resolved')
    if (outcome.settled !== 'resolved') return
    const [entry] = await unzip(outcome.value.archive as Blob)
    expect(await decodeFile(entry.bytes)).toMatchObject({ format: 'png', width: 48, height: 32 })
  })

  it('clears a run once the tab that ran it moves on or closes', async () => {
    const pipeline = chain(['convert', { format: 'png' }])
    const root = await appDirectory()
    const runs = async () =>
      listNames((await directoryAt(root, ['runs'])) as FileSystemDirectoryHandle)
    const host = createWorkerPoolHost({ size: 1, createWorker, index: null })
    await host.begin({ runId: 'first', pipeline, plan: undefined as never })
    await directoryAt(root, ['runs', 'first'])
    await host.begin({ runId: 'second', pipeline, plan: undefined as never })
    await directoryAt(root, ['runs', 'second'])
    await clearRuns(root)
    expect(await runs()).toEqual(['second'])
    host.dispose()
    await clearRuns(root)
    expect(await runs()).toEqual([])
  })

  it('rejects work sent to a worker whose script failed to load', async () => {
    const loadFailed: Promise<unknown>[] = []
    const host = createWorkerPoolHost({
      size: 1,
      createWorker: createBrokenWorker(loadFailed),
      index: null,
    })
    await host.begin({
      runId: 'broken',
      pipeline: chain(['convert', { format: 'png' }]),
      plan: undefined as never,
    })
    await Promise.all(loadFailed)
    const [source] = await sources(['photo.jpg'])
    const outcome = await settlesWithin(
      host.runSource(source, () => {}, new AbortController().signal),
    )
    host.dispose()
    expect(outcome).toMatchObject({ settled: 'rejected', reason: new Error(LOAD_FAILED) })
  })

  it('fails a run with a readable error when the engine cannot load, and again on retry', async () => {
    const host = createWorkerPoolHost({ size: 2, createWorker: createBrokenWorker(), index: null })
    const pipeline = chain(['convert', { format: 'png' }])
    const first = await settlesWithin(run(pipeline, host, ['photo.jpg', 'oriented.jpg']))
    const retry = await settlesWithin(run(pipeline, host, ['photo.jpg', 'oriented.jpg']))
    host.dispose()
    expect([first.settled, retry.settled]).toEqual(['resolved', 'resolved'])
    for (const outcome of [first, retry]) {
      if (outcome.settled !== 'resolved') continue
      expect(outcome.value.result).toMatchObject({ status: 'failed', error: LOAD_FAILED })
    }
  })

  it('starts fresh workers on the next run once the engine loads again', async () => {
    let serverUp = false
    const broken = createBrokenWorker()
    const host = createWorkerPoolHost({
      size: 1,
      createWorker: () => (serverUp ? createWorker() : broken()),
      index: null,
    })
    const pipeline = chain(['convert', { format: 'png' }])
    const down = await run(pipeline, host, ['photo.jpg'])
    serverUp = true
    const up = await run(pipeline, host, ['photo.jpg'])
    host.dispose()
    expect(down.result.status).toBe('failed')
    expect(up.result.status).toBe('complete')
  })
})

import { describe, expect, it } from 'vitest'

import { createInlineHost } from '#/features/engine/inline-host'
import { createMemoryStepCache } from '#/features/engine/memory-step-cache'
import { runPipeline, type SourceItem } from '#/features/engine/runner'
import type { AnyNodeDefinition, ItemType, RunEvent } from '#/features/engine/types'
import {
  createTestRegistry,
  defineTestNode,
  pipelineOf,
  sourceNode,
  type TestPayload,
  testItem,
} from './test-nodes'

function sources(...items: [name: string, format?: string][]): SourceItem[] {
  return items.map(([name, format], index) => {
    const item = testItem(name, format, [index + 1, 7])
    return { index, key: `file-${name}`, meta: item.meta, load: async () => item }
  })
}

function counter() {
  const calls: string[] = []
  const passthrough = (type: string, extra: Partial<Parameters<typeof defineTestNode>[0]> = {}) =>
    defineTestNode({
      type,
      run: async (input, settings) => {
        if (input.mode !== 'each') throw new Error('each only')
        calls.push(`${type}:${input.item.meta.name}`)
        if (settings.fail === input.item.meta.name) throw new Error('Corrupt image')
        const bytes = (input.item.payload as TestPayload).bytes
        const factor = Number(settings.factor ?? 1)
        return [
          {
            port: 'out',
            item: {
              meta: input.item.meta,
              payload: { bytes: bytes.map((value) => value * factor) },
            },
          },
        ]
      },
      ...extra,
    })
  return { calls, passthrough }
}

async function collect(
  run: Parameters<typeof runPipeline>[0],
): Promise<{ events: RunEvent[]; result: Awaited<ReturnType<typeof runPipeline>> }> {
  const events: RunEvent[] = []
  const result = await runPipeline({
    ...run,
    onEvent: (event) => {
      events.push(event)
      run.onEvent?.(event)
    },
  })
  return { events, result }
}

function statuses(events: RunEvent[], nodeId: string) {
  return events
    .filter((event) => event.type === 'node-item' && event.nodeId === nodeId)
    .map((event) => (event.type === 'node-item' ? event.status : ''))
}

describe('runPipeline', () => {
  it('streams each item through the whole pipeline before the next item starts', async () => {
    const { calls, passthrough } = counter()
    const registry = createTestRegistry([sourceNode, passthrough('a'), passthrough('b')])
    const pipeline = pipelineOf(
      [
        ['files', 'source'],
        ['a', 'a'],
        ['b', 'b'],
      ],
      [
        ['files', 'a'],
        ['a', 'b'],
      ],
    )
    await collect({
      pipeline,
      registry,
      sources: sources(['one.png'], ['two.png']),
      host: createInlineHost({ registry, concurrency: 1 }),
    })
    expect(calls).toEqual(['a:one.png', 'b:one.png', 'a:two.png', 'b:two.png'])
  })

  it('counts skipped items separately from failed items and keeps other branches running', async () => {
    const { passthrough } = counter()
    const pngOnly = passthrough('png', { accepts: new Set<ItemType>(['image:png']) })
    const registry = createTestRegistry([sourceNode, pngOnly, passthrough('any')])
    const pipeline = pipelineOf(
      [
        ['files', 'source'],
        ['png', 'png', { fail: 'bad.png' }],
        ['any', 'any'],
      ],
      [
        ['files', 'png'],
        ['files', 'any'],
      ],
    )
    const { events, result } = await collect({
      pipeline,
      registry,
      sources: sources(['good.png'], ['photo.jpeg', 'jpeg'], ['bad.png']),
      host: createInlineHost({ registry }),
    })
    expect(statuses(events, 'png')).toEqual(['processed', 'skipped', 'failed'])
    expect(statuses(events, 'any')).toEqual(['processed', 'processed', 'processed'])
    expect(result.status).toBe('complete')
  })

  it('lets a node turn one image into many data items', async () => {
    const received: string[] = []
    const split = defineTestNode({
      type: 'split',
      produces: () => new Set<ItemType>(['data:json']),
      run: async (input) => {
        if (input.mode !== 'each') throw new Error('each only')
        return [0, 1, 2].map((part) => ({
          port: 'out',
          item: {
            meta: {
              ...input.item.meta,
              kind: 'data' as const,
              format: 'json' as const,
              name: `${input.item.meta.name}-${part}.json`,
            },
            payload: { bytes: new TextEncoder().encode(JSON.stringify({ part })) },
          },
        }))
      },
    })
    const readData = defineTestNode({
      type: 'read-data',
      accepts: new Set<ItemType>(['data:json']),
      run: async (input) => {
        if (input.mode !== 'each') throw new Error('each only')
        const text = new TextDecoder().decode((input.item.payload as TestPayload).bytes)
        received.push(`${input.item.meta.name}=${text}`)
        return [{ port: 'out', item: input.item }]
      },
    })
    const registry = createTestRegistry([sourceNode, split, readData])
    const pipeline = pipelineOf(
      [
        ['files', 'source'],
        ['split', 'split'],
        ['read', 'read-data'],
      ],
      [
        ['files', 'split'],
        ['split', 'read'],
      ],
    )
    await collect({
      pipeline,
      registry,
      sources: sources(['a.png']),
      host: createInlineHost({ registry }),
    })
    expect(received).toEqual([
      'a.png-0.json={"part":0}',
      'a.png-1.json={"part":1}',
      'a.png-2.json={"part":2}',
    ])
  })

  it('waits for every upstream item before running a node that combines items', async () => {
    const order: string[] = []
    const slow = defineTestNode({
      type: 'slow',
      run: async (input) => {
        if (input.mode !== 'each') throw new Error('each only')
        await new Promise((resolve) => setTimeout(resolve, 5))
        order.push(`slow:${input.item.meta.name}`)
        return [{ port: 'out', item: input.item }]
      },
    })
    const join = defineTestNode({
      type: 'join',
      mode: 'all',
      produces: () => new Set<ItemType>(['document:pdf']),
      run: async (input) => {
        if (input.mode !== 'all') throw new Error('all only')
        const names: string[] = []
        for await (const item of input.items) names.push(item.meta.name)
        order.push(`join:${names.join('+')}`)
        return [
          {
            port: 'out',
            item: {
              meta: {
                kind: 'document',
                format: 'pdf',
                name: 'combined.pdf',
                source: { size: 0, format: 'pdf' },
              },
              payload: { bytes: new TextEncoder().encode(`%PDF ${names.length} pages`) },
            },
          },
        ]
      },
    })
    const readDocument = defineTestNode({
      type: 'read-document',
      accepts: new Set<ItemType>(['document:pdf']),
      run: async (input) => {
        if (input.mode !== 'each') throw new Error('each only')
        order.push(new TextDecoder().decode((input.item.payload as TestPayload).bytes))
        return [{ port: 'out', item: input.item }]
      },
    })
    const registry = createTestRegistry([sourceNode, slow, join, readDocument])
    const pipeline = pipelineOf(
      [
        ['files', 'source'],
        ['slow', 'slow'],
        ['join', 'join'],
        ['read', 'read-document'],
      ],
      [
        ['files', 'slow'],
        ['slow', 'join'],
        ['join', 'read'],
      ],
    )
    await collect({
      pipeline,
      registry,
      sources: sources(['1.png'], ['2.png'], ['3.png']),
      host: createInlineHost({ registry, concurrency: 3 }),
    })
    expect(order.slice(0, 3).sort()).toEqual(['slow:1.png', 'slow:2.png', 'slow:3.png'])
    expect(order.slice(3)).toEqual(['join:1.png+2.png+3.png', '%PDF 3 pages'])
  })

  describe('combining nodes that pass their inputs on', () => {
    /** Waits for every item, then sends items with an odd first byte to `out`, others to `rest`. */
    const pick = defineTestNode({
      type: 'pick',
      mode: 'all',
      ports: ['out', 'rest'],
      run: async (input) => {
        if (input.mode !== 'all') throw new Error('all only')
        const results = []
        let index = 0
        for await (const item of input.items) {
          const odd = (item.payload as TestPayload).bytes[0] % 2 === 1
          results.push({ port: odd ? 'out' : 'rest', input: index })
          index += 1
        }
        return results
      },
    })

    function setup() {
      const seen: { name: string; bytes: number[] }[] = []
      const after = defineTestNode({
        type: 'after',
        run: async (input) => {
          if (input.mode !== 'each') throw new Error('each only')
          const { bytes } = input.item.payload as TestPayload
          seen.push({ name: input.item.meta.name, bytes: [...bytes] })
          return [{ port: 'out', item: input.item }]
        },
      })
      const registry = createTestRegistry([sourceNode, pick, after])
      const pipeline = pipelineOf(
        [
          ['files', 'source'],
          ['pick', 'pick'],
          ['after', 'after'],
        ],
        [
          ['files', 'pick'],
          ['pick', 'after'],
        ],
      )
      return { seen, registry, pipeline }
    }

    it('sends the items on unchanged, in order, still knowing their source file', async () => {
      const { seen, registry, pipeline } = setup()
      const { events } = await collect({
        pipeline,
        registry,
        sources: sources(['a.png'], ['b.png'], ['c.png']),
        host: createInlineHost({ registry }),
      })
      // The test items hold [index + 1, 7], so a.png and c.png have odd first bytes.
      expect(seen).toEqual([
        { name: 'a.png', bytes: [1, 7] },
        { name: 'c.png', bytes: [3, 7] },
      ])
      const after = events.flatMap((event) =>
        event.type === 'node-item' && event.nodeId === 'after' ? [event.source] : [],
      )
      expect(after).toEqual([0, 2])
    })

    it('lets later nodes reuse their step cache for the items passed on', async () => {
      const { seen, registry, pipeline } = setup()
      const host = createInlineHost({ registry, cache: createMemoryStepCache() })
      const input = sources(['a.png'], ['b.png'], ['c.png'])
      await collect({ pipeline, registry, sources: input, host })
      seen.length = 0
      const { events } = await collect({ pipeline, registry, sources: input, host })
      expect(statuses(events, 'pick')).toEqual(['cached'])
      expect(statuses(events, 'after')).toEqual(['cached', 'cached'])
      expect(seen).toEqual([])
    })

    it('fails a per-item node that tries to pass its input on', async () => {
      const cheat = defineTestNode({ type: 'cheat', run: async () => [{ port: 'out', input: 0 }] })
      const registry = createTestRegistry([sourceNode, cheat])
      const { events } = await collect({
        pipeline: pipelineOf(
          [
            ['files', 'source'],
            ['cheat', 'cheat'],
          ],
          [['files', 'cheat']],
        ),
        registry,
        sources: sources(['a.png']),
        host: createInlineHost({ registry }),
      })
      expect(events).toContainEqual(
        expect.objectContaining({
          nodeId: 'cheat',
          status: 'failed',
          error: 'Only combining nodes can pass their inputs on.',
        }),
      )
    })
  })

  it('runs only the changed node and the nodes after it when run again', async () => {
    const { calls, passthrough } = counter()
    const registry = createTestRegistry([
      sourceNode,
      passthrough('first'),
      passthrough('middle'),
      passthrough('last'),
      passthrough('side'),
    ])
    const cache = createMemoryStepCache()
    const host = createInlineHost({ registry, cache })
    const build = (factor: number) =>
      pipelineOf(
        [
          ['files', 'source'],
          ['first', 'first'],
          ['middle', 'middle', { factor }],
          ['last', 'last'],
          ['side', 'side'],
        ],
        [
          ['files', 'first'],
          ['first', 'middle'],
          ['middle', 'last'],
          ['first', 'side'],
        ],
      )
    const input = sources(['a.png'], ['b.png'])
    await collect({ pipeline: build(2), registry, sources: input, host })
    expect(calls).toHaveLength(8)

    calls.length = 0
    const { events } = await collect({ pipeline: build(3), registry, sources: input, host })
    expect(calls.sort()).toEqual(['last:a.png', 'last:b.png', 'middle:a.png', 'middle:b.png'])
    expect(statuses(events, 'first')).toEqual(['cached', 'cached'])
    expect(statuses(events, 'side')).toEqual(['cached', 'cached'])

    calls.length = 0
    await collect({ pipeline: build(3), registry, sources: input, host })
    expect(calls).toEqual([])
  })

  it('reruns from the nearest earlier cached node when results were deleted', async () => {
    const { calls, passthrough } = counter()
    const registry = createTestRegistry([
      sourceNode,
      passthrough('first'),
      passthrough('second'),
      passthrough('third'),
    ])
    const cache = createMemoryStepCache()
    const host = createInlineHost({ registry, cache })
    const build = (factor: number) =>
      pipelineOf(
        [
          ['files', 'source'],
          ['first', 'first'],
          ['second', 'second'],
          ['third', 'third', { factor }],
        ],
        [
          ['files', 'first'],
          ['first', 'second'],
          ['second', 'third'],
        ],
      )
    const input = sources(['a.png'])
    await collect({ pipeline: build(1), registry, sources: input, host })
    const secondEntry = cache.keys().find((key) => cache.entryOf(key)?.nodeType === 'second')
    cache.delete(secondEntry as string)

    calls.length = 0
    await collect({ pipeline: build(2), registry, sources: input, host })
    expect(calls).toEqual(['second:a.png', 'third:a.png'])
  })

  it('evicts the least recently used results when the budget is full', async () => {
    const { calls, passthrough } = counter()
    const registry = createTestRegistry([sourceNode, passthrough('only')])
    const cache = createMemoryStepCache({ budgetBytes: 4 })
    const host = createInlineHost({ registry, cache })
    const pipeline = pipelineOf(
      [
        ['files', 'source'],
        ['only', 'only'],
      ],
      [['files', 'only']],
    )
    await collect({ pipeline, registry, sources: sources(['a.png'], ['b.png'], ['c.png']), host })
    expect(cache.usedBytes()).toBeLessThanOrEqual(4)
    calls.length = 0
    await collect({ pipeline, registry, sources: sources(['b.png'], ['c.png']), host })
    expect(calls).toEqual([])
    await collect({ pipeline, registry, sources: sources(['a.png']), host })
    expect(calls).toEqual(['only:a.png'])
  })

  it('delivers what reaches an Output node and passes the same items on', async () => {
    const { calls, passthrough } = counter()
    const output = defineTestNode({
      type: 'output',
      cacheable: false,
      run: async (input, _settings, context) => {
        if (input.mode !== 'each') throw new Error('each only')
        await context.services.output?.write(
          context.nodeId,
          input.item.meta.name,
          (input.item.payload as TestPayload).bytes,
        )
        return [{ port: 'out', item: input.item }]
      },
    })
    const delivering: AnyNodeDefinition = { ...output, delivers: true }
    const registry = createTestRegistry([sourceNode, delivering, passthrough('after')])
    const pipeline = pipelineOf(
      [
        ['files', 'source'],
        ['out', 'output'],
        ['after', 'after'],
      ],
      [
        ['files', 'out'],
        ['out', 'after'],
      ],
    )
    const host = createInlineHost({ registry })
    const { events } = await collect({
      pipeline,
      registry,
      sources: sources(['a.png'], ['a.png']),
      host,
    })
    const delivery = events.find((event) => event.type === 'delivery-ready')
    expect(delivery?.type === 'delivery-ready' && delivery.delivery.files).toEqual([
      { name: 'a.png', size: 2 },
      { name: 'a-2.png', size: 2 },
    ])
    expect(calls).toEqual(['after:a.png', 'after:a.png'])
  })

  it('stops on cancel and keeps finished items', async () => {
    const controller = new AbortController()
    const { calls, passthrough } = counter()
    const registry = createTestRegistry([sourceNode, passthrough('only')])
    const pipeline = pipelineOf(
      [
        ['files', 'source'],
        ['only', 'only'],
      ],
      [['files', 'only']],
    )
    const { result } = await collect({
      pipeline,
      registry,
      sources: sources(['a.png'], ['b.png'], ['c.png']),
      host: createInlineHost({ registry, concurrency: 1 }),
      signal: controller.signal,
      onEvent: (event: RunEvent) => {
        if (event.type === 'item-finished') controller.abort()
      },
    })
    expect(result.status).toBe('cancelled')
    expect(calls).toEqual(['only:a.png'])
  })
})

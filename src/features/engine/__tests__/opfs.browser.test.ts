import { beforeEach, describe, expect, it } from 'vitest'

import { appDirectory, listNames } from '#/features/engine/opfs/files'
import { createOpfsSpillStore } from '#/features/engine/opfs/run-stores'
import { createOpfsStepCache, createStepCacheIndex } from '#/features/engine/opfs/step-cache'
import type { StepCacheEntry } from '#/features/engine/step-cache'

const entry = (nodeType: string): StepCacheEntry => ({
  nodeType,
  outputs: [
    {
      port: 'out',
      key: `${nodeType}-out`,
      meta: { kind: 'image', format: 'png', name: 'a.png', source: { size: 1, format: 'png' } },
      reusesInput: false,
    },
  ],
})

async function freshRoot() {
  const root = await appDirectory()
  for (const name of await listNames(root)) await root.removeEntry(name, { recursive: true })
  return root
}

describe('OPFS step cache', () => {
  beforeEach(async () => {
    await freshRoot()
  })

  it('stores results and loads their payloads back', async () => {
    const root = await appDirectory()
    const index = await createStepCacheIndex(root, 10_000)
    const cache = createOpfsStepCache(root, index)
    const payload = {
      pixels: { data: Uint8ClampedArray.from([1, 2, 3, 4]), width: 1, height: 1 },
      note: 'x',
    }
    await cache.store('k1', entry('resize'), [payload])
    expect(await cache.lookup('k1')).toEqual(entry('resize'))
    const loaded = (await cache.load('k1', 0)) as typeof payload
    expect(loaded.pixels.data).toBeInstanceOf(Uint8ClampedArray)
    expect(Array.from(loaded.pixels.data)).toEqual([1, 2, 3, 4])
    expect(loaded.note).toBe('x')
    expect(await cache.lookup('missing')).toBeUndefined()
  })

  it('deletes the least recently used results over budget and remembers the rest', async () => {
    const root = await appDirectory()
    const index = await createStepCacheIndex(root, 2_600)
    const cache = createOpfsStepCache(root, index)
    const payload = { bytes: new Uint8Array(1_000) }
    await cache.store('a', entry('a'), [payload])
    await cache.store('b', entry('b'), [payload])
    await cache.lookup('a')
    await cache.store('c', entry('c'), [payload])
    expect(await cache.lookup('b')).toBeUndefined()
    expect(await cache.lookup('a')).toBeDefined()
    expect(await cache.lookup('c')).toBeDefined()
    expect(index.usedBytes()).toBeLessThanOrEqual(2_600)
    await index.persist()
    const reloaded = await createStepCacheIndex(root, 2_600)
    expect(reloaded.entry('a')).toEqual(entry('a'))
    expect(reloaded.entry('b')).toBeUndefined()
  })
})

describe('OPFS spill store', () => {
  it('returns waiting items in pipeline order', async () => {
    const root = await freshRoot()
    const spill = createOpfsSpillStore(root, 'run-1', (item) => item.payload)
    const item = (name: string) => ({
      meta: {
        kind: 'image' as const,
        format: 'png' as const,
        name,
        source: { size: 1, format: 'png' as const },
      },
      payload: { bytes: new TextEncoder().encode(name) },
    })
    await spill.put('join', [2, 0], 'k2', item('two'))
    await spill.put('join', [0, 1], 'k0b', item('zero-b'))
    await spill.put('join', [0, 0], 'k0a', item('zero-a'))
    expect((await spill.list('join')).map(({ key }) => key)).toEqual(['k0a', 'k0b', 'k2'])
    const loaded = await spill.load('join', 'k2')
    expect(new TextDecoder().decode((loaded.payload as { bytes: Uint8Array }).bytes)).toBe('two')
  })
})

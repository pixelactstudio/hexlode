import { describe, expect, it } from 'vitest'

import { createPipelineStore } from '#/features/pipelines/storage'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    values,
  }
}

const pipeline = { nodes: [], connections: [] }

describe('saved pipelines', () => {
  it('stores nothing until the user saves', () => {
    const storage = memoryStorage()
    const store = createPipelineStore(storage)
    expect(store.list()).toEqual([])
    expect(storage.values.size).toBe(0)
  })

  it('saves, updates, lists and deletes pipelines', () => {
    const storage = memoryStorage()
    const store = createPipelineStore(storage, () => 1_000)
    const saved = store.save({ name: 'Shop images', pipeline })
    expect(store.list()).toEqual([saved])
    const updated = store.save({ id: saved.id, name: 'Shop', pipeline })
    expect(store.list()).toEqual([{ ...saved, name: 'Shop' }])
    expect(createPipelineStore(storage).get(saved.id)?.name).toBe('Shop')
    expect(updated.id).toBe(saved.id)
    store.remove(saved.id)
    expect(store.list()).toEqual([])
  })

  it('tells subscribers when pipelines change', () => {
    const store = createPipelineStore(memoryStorage())
    let calls = 0
    const unsubscribe = store.subscribe(() => {
      calls += 1
    })
    store.save({ name: 'A', pipeline })
    unsubscribe()
    store.save({ name: 'B', pipeline })
    expect(calls).toBe(1)
  })

  it('ignores damaged storage instead of failing', () => {
    const storage = memoryStorage()
    storage.setItem('hexlode:pipelines', '{broken')
    expect(createPipelineStore(storage).list()).toEqual([])
  })
})

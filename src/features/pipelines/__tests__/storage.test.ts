import { describe, expect, it } from 'vitest'

import { createPipelineStore, PipelineStorageFull } from '#/features/pipelines/storage'

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

  it('counts the runs of a saved pipeline, across reloads and saves', () => {
    const storage = memoryStorage()
    const store = createPipelineStore(storage)
    const saved = store.save({ name: 'Shop images', pipeline })
    expect(store.recordRun(saved.id)).toBe(1)
    expect(store.recordRun(saved.id)).toBe(2)
    store.save({ id: saved.id, name: 'Shop', pipeline })
    expect(createPipelineStore(storage).recordRun(saved.id)).toBe(3)
  })

  it('counts nothing for a pipeline that is not saved', () => {
    const storage = memoryStorage()
    const store = createPipelineStore(storage)
    expect(store.recordRun('not-saved')).toBeUndefined()
    expect(storage.values.size).toBe(0)
  })

  it('refuses a save the browser has no room for and keeps the list as it was', () => {
    const storage = memoryStorage()
    const store = createPipelineStore(storage)
    const first = store.save({ name: 'Small', pipeline })
    storage.setItem = () => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    }
    expect(() => store.save({ name: 'With a large logo', pipeline })).toThrow(PipelineStorageFull)
    expect(store.list()).toEqual([first])
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

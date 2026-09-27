import { describe, expect, it } from 'vitest'

import { STUDIO_DRAFT_KEY } from '#/features/pipelines/constants'
import { createDraftStore } from '#/features/pipelines/draft'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    values,
  }
}

const pipeline = {
  nodes: [{ id: 'files', type: 'files', settings: {}, position: { x: 0, y: 0 } }],
  connections: [],
}

describe('studio draft', () => {
  it('has no draft until one is written', () => {
    expect(createDraftStore(memoryStorage()).read()).toBeNull()
  })

  it('keeps the pipeline being edited, with its name and saved id, across reloads', () => {
    const storage = memoryStorage()
    createDraftStore(storage).write({ name: 'Shop', pipeline, savedId: 'abc' })
    expect(createDraftStore(storage).read()).toEqual({ name: 'Shop', pipeline, savedId: 'abc' })
  })

  it('forgets the draft when cleared', () => {
    const storage = memoryStorage()
    const drafts = createDraftStore(storage)
    drafts.write({ name: 'Shop', pipeline, savedId: null })
    drafts.clear()
    expect(drafts.read()).toBeNull()
    expect(storage.values.has(STUDIO_DRAFT_KEY)).toBe(false)
  })

  it('ignores a damaged draft', () => {
    const storage = memoryStorage()
    storage.setItem(STUDIO_DRAFT_KEY, '{"name": 3')
    expect(createDraftStore(storage).read()).toBeNull()
    storage.setItem(STUDIO_DRAFT_KEY, JSON.stringify({ name: 'x', pipeline: { nodes: 'no' } }))
    expect(createDraftStore(storage).read()).toBeNull()
  })

  it('works without storage', () => {
    const drafts = createDraftStore(undefined)
    drafts.write({ name: 'Shop', pipeline, savedId: null })
    expect(drafts.read()).toBeNull()
  })
})

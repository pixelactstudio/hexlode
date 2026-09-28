import { describe, expect, it } from 'vitest'

import {
  DRAFT_RECOVERY_MAX_AGE_MS,
  LEGACY_STUDIO_DRAFT_KEY,
  STUDIO_DRAFT_KEY,
  STUDIO_RECOVERY_KEY,
} from '#/features/pipelines/constants'
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

/** One browser: storage shared by its tabs, a clock, and a way to open tabs. */
function browser() {
  const shared = memoryStorage()
  let time = 1_000_000
  let ids = 0
  return {
    shared,
    advance: (ms: number) => {
      time += ms
    },
    tab(storage = memoryStorage()) {
      return {
        storage,
        drafts: createDraftStore({
          tab: storage,
          browser: shared,
          now: () => time,
          createId: () => `tab-${++ids}`,
        }),
      }
    },
  }
}

describe('studio draft', () => {
  it('has no draft until one is written', () => {
    expect(browser().tab().drafts.read()).toBeNull()
  })

  it('keeps the pipeline being edited, with its name, saved id and changes, across reloads', () => {
    const b = browser()
    const tab = b.tab()
    tab.drafts.write({ name: 'Shop', pipeline, savedId: 'abc', dirty: true })
    const reloaded = b.tab(tab.storage)
    expect(reloaded.drafts.read()).toEqual({ name: 'Shop', pipeline, savedId: 'abc', dirty: true })
  })

  it('starts a new tab without a draft, so the Studio offers the templates', () => {
    const b = browser()
    b.tab().drafts.write({ name: 'Shop', pipeline, savedId: null, dirty: true })
    expect(b.tab().drafts.read()).toBeNull()
  })

  it('offers the last unsaved pipeline to a new tab for a day', () => {
    const b = browser()
    b.tab().drafts.write({ name: 'Shop', pipeline, savedId: null, dirty: true })
    b.advance(60_000)
    expect(b.tab().drafts.recoverable()).toEqual({
      name: 'Shop',
      pipeline,
      savedId: null,
      dirty: true,
      updatedAt: 1_000_000,
    })
    b.advance(DRAFT_RECOVERY_MAX_AGE_MS)
    expect(b.tab().drafts.recoverable()).toBeNull()
    expect(b.shared.values.has(STUDIO_RECOVERY_KEY)).toBe(false)
  })

  it('offers nothing once the tab that made the changes saves them', () => {
    const b = browser()
    const tab = b.tab()
    tab.drafts.write({ name: 'Shop', pipeline, savedId: null, dirty: true })
    tab.drafts.write({ name: 'Shop', pipeline, savedId: 'abc', dirty: false })
    expect(b.tab().drafts.recoverable()).toBeNull()
  })

  it('keeps offering one tab’s unsaved changes when another tab saves its own', () => {
    const b = browser()
    b.tab().drafts.write({ name: 'Shop', pipeline, savedId: null, dirty: true })
    b.tab().drafts.write({ name: 'Other', pipeline, savedId: 'xyz', dirty: false })
    expect(b.tab().drafts.recoverable()?.name).toBe('Shop')
  })

  it('forgets the recovered pipeline when discarded', () => {
    const b = browser()
    b.tab().drafts.write({ name: 'Shop', pipeline, savedId: null, dirty: true })
    b.tab().drafts.discardRecovery()
    expect(b.tab().drafts.recoverable()).toBeNull()
  })

  it('forgets the tab’s draft when cleared', () => {
    const b = browser()
    const tab = b.tab()
    tab.drafts.write({ name: 'Shop', pipeline, savedId: null })
    tab.drafts.clear()
    expect(tab.drafts.read()).toBeNull()
    expect(tab.storage.values.has(STUDIO_DRAFT_KEY)).toBe(false)
  })

  // Earlier versions kept one draft for the whole browser, which every new tab reopened.
  it('removes the old browser-wide draft', () => {
    const b = browser()
    b.shared.setItem(LEGACY_STUDIO_DRAFT_KEY, JSON.stringify({ name: 'Old', pipeline }))
    b.tab()
    expect(b.shared.values.has(LEGACY_STUDIO_DRAFT_KEY)).toBe(false)
  })

  it('ignores a damaged draft', () => {
    const b = browser()
    const tab = b.tab()
    tab.storage.setItem(STUDIO_DRAFT_KEY, '{"name": 3')
    expect(tab.drafts.read()).toBeNull()
    tab.storage.setItem(STUDIO_DRAFT_KEY, JSON.stringify({ name: 'x', pipeline: { nodes: 'no' } }))
    expect(tab.drafts.read()).toBeNull()
    b.shared.setItem(STUDIO_RECOVERY_KEY, '{"updatedAt": "soon"}')
    expect(tab.drafts.recoverable()).toBeNull()
  })

  it('works without storage', () => {
    const drafts = createDraftStore({ tab: undefined, browser: undefined })
    drafts.write({ name: 'Shop', pipeline, savedId: null, dirty: true })
    expect(drafts.read()).toBeNull()
    expect(drafts.recoverable()).toBeNull()
  })
})

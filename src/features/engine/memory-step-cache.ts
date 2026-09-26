import { DEFAULT_STEP_CACHE_BUDGET_BYTES } from '#/features/engine/constants'
import { payloadBytes } from '#/features/engine/payload'
import type { StepCache, StepCacheEntry } from '#/features/engine/step-cache'

interface StoredEntry {
  entry: StepCacheEntry
  payloads: (unknown | undefined)[]
  bytes: number
}

/** Step cache in memory. Used for live previews and tests. Evicts least recently used. */
export function createMemoryStepCache(options: { budgetBytes?: number } = {}) {
  const budget = options.budgetBytes ?? DEFAULT_STEP_CACHE_BUDGET_BYTES
  const entries = new Map<string, StoredEntry>()
  let used = 0

  const remove = (key: string) => {
    const stored = entries.get(key)
    if (!stored) return
    used -= stored.bytes
    entries.delete(key)
  }

  const touch = (key: string) => {
    const stored = entries.get(key)
    if (!stored) return undefined
    entries.delete(key)
    entries.set(key, stored)
    return stored
  }

  const cache: StepCache & {
    keys(): string[]
    entryOf(key: string): StepCacheEntry | undefined
    delete(key: string): void
    usedBytes(): number
    clear(): void
  } = {
    async lookup(key) {
      return touch(key)?.entry
    },
    async load(key, index) {
      return touch(key)?.payloads[index]
    },
    async store(key, entry, payloads) {
      remove(key)
      const bytes = payloadBytes(payloads)
      if (bytes > budget) return
      while (used + bytes > budget) {
        const oldest = entries.keys().next().value
        if (oldest === undefined) break
        remove(oldest)
      }
      entries.set(key, { entry, payloads, bytes })
      used += bytes
    },
    keys: () => [...entries.keys()],
    entryOf: (key) => entries.get(key)?.entry,
    delete: remove,
    usedBytes: () => used,
    clear: () => {
      entries.clear()
      used = 0
    },
  }
  return cache
}

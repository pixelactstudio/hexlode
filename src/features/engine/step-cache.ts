import type { ItemMeta } from '#/features/engine/types'

export interface StepCacheOutput {
  port: string
  key: string
  meta: ItemMeta
  /** The output reuses the input payload unchanged (Rename, Inspect), so nothing is stored. */
  reusesInput: boolean
}

export interface StepCacheEntry {
  nodeType: string
  outputs: StepCacheOutput[]
}

/**
 * A node's stored results, keyed by entry key. Payloads load separately so a hit that nothing
 * downstream needs costs no reads.
 */
export interface StepCache {
  lookup(key: string): Promise<StepCacheEntry | undefined>
  /** Returns undefined when the payload was deleted since the lookup. */
  load(key: string, index: number): Promise<unknown | undefined>
  store(key: string, entry: StepCacheEntry, payloads: (unknown | undefined)[]): Promise<void>
}

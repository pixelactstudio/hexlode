import {
  directoryAt,
  listNames,
  readFile,
  removeEntry,
  writeFile,
} from '#/features/engine/opfs/files'
import { decodeBlob, decodeHeader, encodeRecord } from '#/features/engine/opfs/record-file'
import type { StepCache, StepCacheEntry } from '#/features/engine/step-cache'

export const STEP_CACHE_PATH = ['step-cache']
const INDEX_FILE = 'index.json'

export interface StepCacheReport {
  used(key: string): void
  stored(key: string, bytes: number, entry: StepCacheEntry): void
}

/**
 * Reads and writes step cache files. Used inside workers; the index on the main thread decides
 * what to delete.
 */
export function createOpfsStepCache(
  root: FileSystemDirectoryHandle,
  report: StepCacheReport,
): StepCache {
  const directory = directoryAt(root, STEP_CACHE_PATH)
  const reader = (dir: FileSystemDirectoryHandle, key: string) => (start: number, length: number) =>
    readFile(dir, `${key}.bin`, start, length)
  return {
    async lookup(key) {
      try {
        const record = await decodeHeader<StepCacheEntry>(
          reader((await directory) as FileSystemDirectoryHandle, key),
        )
        if (!record) return undefined
        report.used(key)
        return record.header
      } catch {
        return undefined
      }
    },
    async load(key, index) {
      try {
        const read = reader((await directory) as FileSystemDirectoryHandle, key)
        const record = await decodeHeader<StepCacheEntry>(read)
        return record ? await decodeBlob(record, index, read) : undefined
      } catch {
        return undefined
      }
    },
    async store(key, entry, payloads) {
      const { parts } = encodeRecord(entry, payloads)
      try {
        const bytes = await writeFile(
          (await directory) as FileSystemDirectoryHandle,
          `${key}.bin`,
          parts,
        )
        report.stored(key, bytes, entry)
      } catch {
        // Another worker holds the file, or storage is full. The run continues without caching.
      }
    },
  }
}

interface IndexRecord {
  bytes: number
  used: number
  entry: StepCacheEntry
}

/**
 * The step cache's bookkeeping on the main thread: sizes, last use and the 5 GB budget. Deletes
 * the least recently used results when the budget is exceeded.
 */
export async function createStepCacheIndex(root: FileSystemDirectoryHandle, budgetBytes: number) {
  const directory = (await directoryAt(root, STEP_CACHE_PATH)) as FileSystemDirectoryHandle
  const records = new Map<string, IndexRecord>()
  let budget = budgetBytes
  let used = 0
  let clock = 0

  try {
    const saved = await readFile(directory, INDEX_FILE)
    if (saved) {
      const parsed = JSON.parse(new TextDecoder().decode(saved)) as [string, IndexRecord][]
      const onDisk = new Set(await listNames(directory))
      for (const [key, record] of parsed.sort((a, b) => a[1].used - b[1].used)) {
        if (!onDisk.has(`${key}.bin`)) continue
        records.set(key, record)
        used += record.bytes
        clock = Math.max(clock, record.used)
      }
    }
  } catch {
    records.clear()
    used = 0
  }

  const evict = async () => {
    for (const [key, record] of records) {
      if (used <= budget) break
      if (await removeEntry(directory, `${key}.bin`)) {
        records.delete(key)
        used -= record.bytes
      }
    }
  }

  return {
    used(key: string) {
      const record = records.get(key)
      if (!record) return
      records.delete(key)
      record.used = ++clock
      records.set(key, record)
    },
    async stored(key: string, bytes: number, entry: StepCacheEntry) {
      const previous = records.get(key)
      if (previous) used -= previous.bytes
      records.delete(key)
      records.set(key, { bytes, used: ++clock, entry })
      used += bytes
      await evict()
    },
    entry: (key: string) => records.get(key)?.entry,
    usedBytes: () => used,
    budgetBytes: () => budget,
    async setBudget(bytes: number) {
      budget = bytes
      await evict()
    },
    async persist() {
      const bytes = new TextEncoder().encode(JSON.stringify([...records]))
      await writeFile(directory, INDEX_FILE, [bytes])
    },
    /** Deletes every stored result, including files the index does not know about. */
    async clear() {
      for (const name of await listNames(directory)) await removeEntry(directory, name)
      records.clear()
      used = 0
    },
  }
}

export type StepCacheIndex = Awaited<ReturnType<typeof createStepCacheIndex>>

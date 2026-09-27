/**
 * Saved pipelines in browser storage. Nothing is written until the user clicks Save.
 */
import { SAVED_PIPELINES_KEY } from '#/features/pipelines/constants'
import type { NamedPipeline, SavedPipeline } from '#/features/pipelines/types'
import { savedPipelinesSchema } from '#/features/pipelines/validators'
import { createId } from '#/lib/create-id'

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function createPipelineStore(storage: KeyValueStorage | undefined, now = () => Date.now()) {
  const listeners = new Set<() => void>()
  let cached: SavedPipeline[] | undefined

  const read = (): SavedPipeline[] => {
    if (cached) return cached
    try {
      const raw = storage?.getItem(SAVED_PIPELINES_KEY)
      const parsed = raw ? savedPipelinesSchema.safeParse(JSON.parse(raw)) : undefined
      cached = parsed?.success ? parsed.data : []
    } catch {
      cached = []
    }
    return cached
  }

  const write = (pipelines: SavedPipeline[]) => {
    cached = pipelines
    storage?.setItem(SAVED_PIPELINES_KEY, JSON.stringify(pipelines))
    for (const listener of listeners) listener()
  }

  return {
    list: read,
    get: (id: string) => read().find((pipeline) => pipeline.id === id),
    save(pipeline: NamedPipeline & { id?: string }): SavedPipeline {
      const existing = pipeline.id ? read().find((saved) => saved.id === pipeline.id) : undefined
      const saved: SavedPipeline = {
        id: existing?.id ?? createId(),
        name: pipeline.name,
        pipeline: pipeline.pipeline,
        createdAt: existing?.createdAt ?? now(),
        updatedAt: now(),
      }
      write(
        existing ? read().map((item) => (item.id === saved.id ? saved : item)) : [...read(), saved],
      )
      return saved
    },
    remove(id: string) {
      write(read().filter((pipeline) => pipeline.id !== id))
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export type PipelineStore = ReturnType<typeof createPipelineStore>

let browserStore: PipelineStore | undefined

/** The store for this browser. Empty during server rendering. */
export function pipelineStore() {
  if (typeof window === 'undefined') return createPipelineStore(undefined)
  browserStore ??= createPipelineStore(window.localStorage)
  return browserStore
}

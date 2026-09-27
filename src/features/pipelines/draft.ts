/**
 * The pipeline open in the Studio, written on every change so a reload or a crashed tab does not
 * lose it. It holds nodes, settings and the name, never images.
 */
import { STUDIO_DRAFT_KEY } from '#/features/pipelines/constants'
import type { KeyValueStorage } from '#/features/pipelines/storage'
import type { NamedPipeline } from '#/features/pipelines/types'
import { studioDraftSchema } from '#/features/pipelines/validators'

export interface StudioDraft extends NamedPipeline {
  /** The saved pipeline this draft edits, if any. */
  savedId: string | null
}

export function createDraftStore(storage: KeyValueStorage | undefined) {
  return {
    read(): StudioDraft | null {
      try {
        const raw = storage?.getItem(STUDIO_DRAFT_KEY)
        const parsed = raw ? studioDraftSchema.safeParse(JSON.parse(raw)) : undefined
        return parsed?.success ? parsed.data : null
      } catch {
        return null
      }
    },
    write(draft: StudioDraft) {
      try {
        storage?.setItem(STUDIO_DRAFT_KEY, JSON.stringify(draft))
      } catch {
        // Storage is full or blocked; the draft is a convenience, so editing carries on.
      }
    },
    clear() {
      storage?.removeItem(STUDIO_DRAFT_KEY)
    },
  }
}

/** The draft store for this browser. Empty during server rendering. */
export function draftStore() {
  return createDraftStore(typeof window === 'undefined' ? undefined : window.localStorage)
}

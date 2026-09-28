/**
 * The pipeline open in the Studio. Each tab keeps its own draft in session storage, so a reload
 * keeps the pipeline while a new tab starts fresh. The last pipeline with unsaved changes is also
 * kept in local storage for a day, for a new tab to offer after a tab was closed by mistake.
 * Drafts hold nodes, settings and the name, never images.
 */
import {
  DRAFT_RECOVERY_MAX_AGE_MS,
  LEGACY_STUDIO_DRAFT_KEY,
  STUDIO_DRAFT_KEY,
  STUDIO_RECOVERY_KEY,
  STUDIO_TAB_KEY,
} from '#/features/pipelines/constants'
import type { KeyValueStorage } from '#/features/pipelines/storage'
import type { NamedPipeline } from '#/features/pipelines/types'
import { recoverableDraftSchema, studioDraftSchema } from '#/features/pipelines/validators'

export interface StudioDraft extends NamedPipeline {
  /** The saved pipeline this draft edits, if any. */
  savedId: string | null
  /** The draft has changes its saved pipeline lacks. */
  dirty?: boolean
}

export interface RecoverableDraft extends StudioDraft {
  /** When the changes were made, in milliseconds since the epoch. */
  updatedAt: number
}

export interface DraftStorageOptions {
  /** This tab's session storage. */
  tab: KeyValueStorage | undefined
  /** Local storage, shared by every tab. */
  browser: KeyValueStorage | undefined
  now?: () => number
  createId?: () => string
}

function readJson(storage: KeyValueStorage | undefined, key: string): unknown {
  try {
    const raw = storage?.getItem(key)
    return raw ? JSON.parse(raw) : undefined
  } catch {
    return undefined
  }
}

function writeJson(storage: KeyValueStorage | undefined, key: string, value: unknown) {
  try {
    storage?.setItem(key, JSON.stringify(value))
  } catch {
    // Storage is full or blocked; the draft is a convenience, so editing carries on.
  }
}

function remove(storage: KeyValueStorage | undefined, key: string) {
  try {
    storage?.removeItem(key)
  } catch {
    // Blocked storage has nothing to remove.
  }
}

export function createDraftStore({
  tab,
  browser,
  now = () => Date.now(),
  createId = () => crypto.randomUUID(),
}: DraftStorageOptions) {
  remove(browser, LEGACY_STUDIO_DRAFT_KEY)

  const ownId = () => {
    const existing = tab?.getItem(STUDIO_TAB_KEY)
    if (existing) return existing
    const id = createId()
    try {
      tab?.setItem(STUDIO_TAB_KEY, id)
    } catch {
      // Without a stored id, this tab's recovery copy simply stays until it expires.
    }
    return id
  }

  const readRecovery = () => {
    const parsed = recoverableDraftSchema.safeParse(readJson(browser, STUDIO_RECOVERY_KEY))
    return parsed.success ? parsed.data : null
  }

  return {
    /** This tab's draft, or null in a new tab. */
    read(): StudioDraft | null {
      const parsed = studioDraftSchema.safeParse(readJson(tab, STUDIO_DRAFT_KEY))
      return parsed.success ? parsed.data : null
    },
    write(draft: StudioDraft) {
      writeJson(tab, STUDIO_DRAFT_KEY, draft)
      if (!tab || !browser) return
      const id = ownId()
      if (draft.dirty) {
        writeJson(browser, STUDIO_RECOVERY_KEY, { ...draft, updatedAt: now(), tabId: id })
      } else if (readRecovery()?.tabId === id) {
        remove(browser, STUDIO_RECOVERY_KEY)
      }
    },
    clear() {
      remove(tab, STUDIO_DRAFT_KEY)
    },
    /** The last unsaved pipeline from any tab, if it changed within the last day. */
    recoverable(): RecoverableDraft | null {
      const recovery = readRecovery()
      if (!recovery) return null
      if (now() - recovery.updatedAt > DRAFT_RECOVERY_MAX_AGE_MS) {
        remove(browser, STUDIO_RECOVERY_KEY)
        return null
      }
      const { tabId: _tabId, ...draft } = recovery
      return draft
    },
    discardRecovery() {
      remove(browser, STUDIO_RECOVERY_KEY)
    },
  }
}

/** The draft store for this tab. Empty during server rendering. */
export function draftStore() {
  return typeof window === 'undefined'
    ? createDraftStore({ tab: undefined, browser: undefined })
    : createDraftStore({ tab: window.sessionStorage, browser: window.localStorage })
}

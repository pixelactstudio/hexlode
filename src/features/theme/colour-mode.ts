/**
 * The colour mode the user picked: dark, light or system. It is kept in browser storage and
 * applied to `<html>` as an attribute, which the stylesheet maps to `color-scheme`, so every
 * token switches between its light and dark value.
 */
import {
  COLOUR_MODE_ATTRIBUTE,
  COLOUR_MODE_KEY,
  COLOUR_MODES,
  DEFAULT_COLOUR_MODE,
} from '#/features/theme/constants'
import type { ColourMode } from '#/features/theme/types'
import { colourModeSchema } from '#/features/theme/validators'

interface ModeStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

interface ModeRoot {
  setAttribute: (name: string, value: string) => void
}

export function createColourModeStore(
  storage: ModeStorage | undefined,
  root: ModeRoot | undefined,
) {
  const listeners = new Set<() => void>()
  let current: ColourMode | undefined
  const read = (): ColourMode => {
    try {
      return colourModeSchema.parse(storage?.getItem(COLOUR_MODE_KEY) ?? DEFAULT_COLOUR_MODE)
    } catch {
      return DEFAULT_COLOUR_MODE
    }
  }
  return {
    get(): ColourMode {
      current ??= read()
      return current
    },
    set(mode: ColourMode) {
      current = mode
      root?.setAttribute(COLOUR_MODE_ATTRIBUTE, mode)
      try {
        storage?.setItem(COLOUR_MODE_KEY, mode)
      } catch {
        // Storage is blocked; the mode still applies until the page is closed.
      }
      for (const listener of listeners) listener()
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

let store: ReturnType<typeof createColourModeStore> | undefined

/** The colour mode store for this browser. */
export function colourModeStore() {
  if (typeof window === 'undefined') return createColourModeStore(undefined, undefined)
  store ??= createColourModeStore(window.localStorage, document.documentElement)
  return store
}

/**
 * Runs in `<head>` before the page paints, so a stored light mode never flashes dark first. It
 * must stay self-contained: it is inlined as text.
 */
export const COLOUR_MODE_SCRIPT = `(function () {
  var mode = ${JSON.stringify(DEFAULT_COLOUR_MODE)};
  try {
    var stored = localStorage.getItem(${JSON.stringify(COLOUR_MODE_KEY)});
    if (${JSON.stringify(COLOUR_MODES)}.indexOf(stored) !== -1) mode = stored;
  } catch (error) {}
  document.documentElement.setAttribute(${JSON.stringify(COLOUR_MODE_ATTRIBUTE)}, mode);
})();`

import type { ColourMode } from '#/features/theme/types'

export const COLOUR_MODES = ['dark', 'light', 'system'] as const satisfies readonly ColourMode[]

/** Hexlode is pitch dark until the user picks light or their system's mode. */
export const DEFAULT_COLOUR_MODE: ColourMode = 'dark'

/** Browser storage key for the colour mode the user picked. */
export const COLOUR_MODE_KEY = 'hexlode:colour-mode'

/** Set on `<html>`; the stylesheet maps it to `color-scheme`. */
export const COLOUR_MODE_ATTRIBUTE = 'data-colour-mode'

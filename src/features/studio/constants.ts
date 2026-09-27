/** Settings edits to one node within this window become one undo step. */
export const SETTINGS_UNDO_WINDOW_MS = 800
export const MAX_UNDO_STEPS = 100
/** Below this width the Studio shows a message instead of the canvas. */
export const STUDIO_MIN_WIDTH = 1024
/** Live previews wait this long after the last change. */
export const PREVIEW_DEBOUNCE_MS = 250
export const NODE_DRAG_TYPE = 'application/x-hexlode-node'
/** How the canvas frames a pipeline: nodes stay readable rather than shrinking to fit. */
export const FIT_VIEW = { padding: 0.12, maxZoom: 1, minZoom: 0.7 }
/** A duplicated node appears this far below and to the right of the original. */
export const DUPLICATE_OFFSET = 40
/** The draft of the open pipeline is written this long after the last change. */
export const DRAFT_SAVE_DELAY_MS = 400

/** The node library, and the rail of icons it folds into. */
export const LIBRARY_WIDTH = 248
export const LIBRARY_RAIL_WIDTH = 56

export const INSPECTOR_WIDTH = 380

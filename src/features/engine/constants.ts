export const GIGABYTE = 1024 ** 3

/** The step cache budget unless the user changes it in settings. */
export const DEFAULT_STEP_CACHE_BUDGET_BYTES = 5 * GIGABYTE
export const MIN_STEP_CACHE_BUDGET_BYTES = 0.5 * GIGABYTE
export const MAX_STEP_CACHE_BUDGET_BYTES = 100 * GIGABYTE

/** Live previews keep their own small cache in memory. */
export const PREVIEW_CACHE_BUDGET_BYTES = 256 * 1024 ** 2

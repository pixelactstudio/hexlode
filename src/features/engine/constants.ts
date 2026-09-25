export const GIGABYTE = 1024 ** 3

/** The step cache budget unless the user changes it in settings. */
export const DEFAULT_STEP_CACHE_BUDGET_BYTES = 5 * GIGABYTE
export const MIN_STEP_CACHE_BUDGET_BYTES = 0.5 * GIGABYTE
export const MAX_STEP_CACHE_BUDGET_BYTES = 100 * GIGABYTE

/** Live previews keep their own small cache in memory. */
export const PREVIEW_CACHE_BUDGET_BYTES = 256 * 1024 ** 2

/** Share of device memory the worker pool may plan to use. */
export const MEMORY_SHARE_FOR_WORKERS = 0.5
/** A worker holds the file, its pixels and a resized or encoded copy at once. */
export const WORKER_MEMORY_PER_DECODED_BYTE = 5
/** Browsers without `navigator.deviceMemory` (Firefox, Safari) are assumed to have this much. */
export const DEFAULT_DEVICE_MEMORY_GB = 8

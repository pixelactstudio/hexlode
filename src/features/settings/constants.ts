import { DEFAULT_STEP_CACHE_BUDGET_BYTES, GIGABYTE } from '#/features/engine/constants'

export const SETTINGS_KEY = 'hexlode:settings'
export const DEFAULT_STEP_CACHE_GIGABYTES = DEFAULT_STEP_CACHE_BUDGET_BYTES / GIGABYTE
export const MIN_STEP_CACHE_GIGABYTES = 0.5
export const MAX_STEP_CACHE_GIGABYTES = 100

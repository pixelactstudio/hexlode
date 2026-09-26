/**
 * User settings. Written to browser storage only when the user changes one.
 */
import { z } from 'zod'

import {
  DEFAULT_STEP_CACHE_GIGABYTES,
  MAX_STEP_CACHE_GIGABYTES,
  MIN_STEP_CACHE_GIGABYTES,
  SETTINGS_KEY,
} from '#/features/settings/constants'

const settingsSchema = z.object({
  stepCacheGigabytes: z
    .number()
    .min(MIN_STEP_CACHE_GIGABYTES)
    .max(MAX_STEP_CACHE_GIGABYTES)
    .catch(DEFAULT_STEP_CACHE_GIGABYTES)
    .default(DEFAULT_STEP_CACHE_GIGABYTES),
})

export type Settings = z.infer<typeof settingsSchema>

function storage() {
  return typeof window === 'undefined' ? undefined : window.localStorage
}

export function readSettings(): Settings {
  try {
    const raw = storage()?.getItem(SETTINGS_KEY)
    return settingsSchema.parse(raw ? JSON.parse(raw) : {})
  } catch {
    return settingsSchema.parse({})
  }
}

export function writeSettings(changes: Partial<Settings>) {
  const next = settingsSchema.parse({ ...readSettings(), ...changes })
  storage()?.setItem(SETTINGS_KEY, JSON.stringify(next))
  return next
}

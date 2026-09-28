import { z } from 'zod'

import { ENVIRONMENT_PATTERN } from '#/features/usage/constants'
import type { PublicConfig } from '#/features/usage/types'

const optionalText = z.string().trim().min(1).optional().catch(undefined)
const optionalUrl = z.url().optional().catch(undefined)
const optionalEnvironment = z.string().regex(ENVIRONMENT_PATTERN).optional().catch(undefined)

function withoutEmpty(config: PublicConfig): PublicConfig {
  return Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== undefined),
  ) as PublicConfig
}

/** Picks the public settings out of an environment. Empty or malformed values are left out. */
export function parsePublicConfig(env: Record<string, string | undefined>): PublicConfig {
  return withoutEmpty({
    posthogKey: optionalText.parse(env.VITE_POSTHOG_KEY),
    posthogHost: optionalUrl.parse(env.VITE_POSTHOG_HOST),
    sentryDsn: optionalUrl.parse(env.VITE_SENTRY_DSN),
    appVersion: optionalText.parse(env.HEXLODE_VERSION),
    environment:
      optionalEnvironment.parse(env.HEXLODE_ENVIRONMENT) ??
      (env.NODE_ENV === 'production' ? 'production' : 'development'),
  })
}

const publicConfigSchema = z.object({
  posthogKey: optionalText,
  posthogHost: optionalUrl,
  sentryDsn: optionalUrl,
  appVersion: optionalText,
  environment: optionalEnvironment,
})

/** Reads the settings the server wrote into the page. Anything malformed is left out. */
export function parsePublicConfigJson(text: string | null | undefined): PublicConfig {
  if (!text) return {}
  try {
    const parsed = publicConfigSchema.safeParse(JSON.parse(text))
    return parsed.success ? withoutEmpty(parsed.data) : {}
  } catch {
    return {}
  }
}

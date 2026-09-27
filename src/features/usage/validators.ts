import { z } from 'zod'

import type { PublicConfig } from '#/features/usage/types'

const optionalText = z.string().trim().min(1).optional().catch(undefined)
const optionalUrl = z.url().optional().catch(undefined)

/** Picks the public settings out of an environment. Empty or malformed values are left out. */
export function parsePublicConfig(env: Record<string, string | undefined>): PublicConfig {
  const config: PublicConfig = {
    posthogKey: optionalText.parse(env.VITE_POSTHOG_KEY),
    posthogHost: optionalUrl.parse(env.VITE_POSTHOG_HOST),
    sentryDsn: optionalUrl.parse(env.VITE_SENTRY_DSN),
  }
  return Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== undefined),
  ) as PublicConfig
}

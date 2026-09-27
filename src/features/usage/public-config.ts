import { createServerFn } from '@tanstack/react-start'

import { parsePublicConfig } from '#/features/usage/validators'

/**
 * The public analytics and error report settings, read on the server so a deployment sets them in
 * its environment. Values passed as build arguments are the fallback.
 */
export const getPublicConfig = createServerFn({ method: 'GET' }).handler(() =>
  parsePublicConfig({
    VITE_POSTHOG_KEY: process.env.VITE_POSTHOG_KEY || import.meta.env.VITE_POSTHOG_KEY,
    VITE_POSTHOG_HOST: process.env.VITE_POSTHOG_HOST || import.meta.env.VITE_POSTHOG_HOST,
    VITE_SENTRY_DSN: process.env.VITE_SENTRY_DSN || import.meta.env.VITE_SENTRY_DSN,
  }),
)

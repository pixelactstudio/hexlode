import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

const isServer = typeof window === 'undefined'

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(32).optional(),
    BETTER_AUTH_URL: z.url().optional(),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
  },
  clientPrefix: 'VITE_',
  client: {
    VITE_APP_TITLE: z.string().min(1).optional(),
    VITE_POSTHOG_KEY: z.string().min(1).optional(),
    VITE_POSTHOG_HOST: z.url().optional(),
    VITE_SENTRY_DSN: z.url().optional(),
    VITE_SENTRY_ORG: z.string().min(1).optional(),
    VITE_SENTRY_PROJECT: z.string().min(1).optional(),
  },
  runtimeEnv: isServer ? process.env : import.meta.env,
  isServer,
  skipValidation: isServer && process.env.SKIP_ENV_VALIDATION === '1',
  emptyStringAsUndefined: true,
  createFinalSchema: (shape) =>
    z
      .object(shape)
      .refine(
        ({ BETTER_AUTH_SECRET, BETTER_AUTH_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET }) =>
          (!GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_SECRET) ||
          Boolean(
            BETTER_AUTH_SECRET && BETTER_AUTH_URL && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET,
          ),
        {
          message:
            'Google sign-in requires its client ID, client secret, auth URL, and auth secret',
          path: ['GOOGLE_CLIENT_ID'],
        },
      ),
})

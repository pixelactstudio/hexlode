import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { env } from '#/env'

function createAuth(secret: string) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret,
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {},
    plugins: [tanstackStartCookies()],
  })
}

let instance: ReturnType<typeof createAuth> | undefined

/**
 * Accounts are dormant until cloud mode (ADR 0006). Auth exists only when its secret is
 * configured, so version 1 runs without it.
 */
export function getAuth() {
  if (!env.BETTER_AUTH_SECRET) return undefined
  instance ??= createAuth(env.BETTER_AUTH_SECRET)
  return instance
}

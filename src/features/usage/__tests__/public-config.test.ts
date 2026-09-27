import { describe, expect, it } from 'vitest'

import { parsePublicConfig } from '#/features/usage/validators'

describe('public config', () => {
  it('reads the PostHog and Sentry settings from the server environment', () => {
    expect(
      parsePublicConfig({
        VITE_POSTHOG_KEY: 'phc_live',
        VITE_POSTHOG_HOST: 'https://eu.i.posthog.com',
        VITE_SENTRY_DSN: 'https://key@o1.ingest.sentry.io/2',
        DATABASE_URL: 'postgresql://secret@db/hexlode',
      }),
    ).toEqual({
      posthogKey: 'phc_live',
      posthogHost: 'https://eu.i.posthog.com',
      sentryDsn: 'https://key@o1.ingest.sentry.io/2',
    })
  })

  it('leaves out settings that are empty or not valid', () => {
    expect(
      parsePublicConfig({
        VITE_POSTHOG_KEY: ' ',
        VITE_POSTHOG_HOST: 'not a url',
        VITE_SENTRY_DSN: '',
      }),
    ).toEqual({})
  })
})

import { describe, expect, it } from 'vitest'

import { parsePublicConfig, parsePublicConfigJson } from '#/features/usage/validators'

describe('public config', () => {
  it('reads the PostHog and Sentry settings from the server environment', () => {
    expect(
      parsePublicConfig({
        VITE_POSTHOG_KEY: 'phc_live',
        VITE_POSTHOG_HOST: 'https://eu.i.posthog.com',
        VITE_SENTRY_DSN: 'https://key@o1.ingest.sentry.io/2',
        HEXLODE_VERSION: '1.4.0',
        DATABASE_URL: 'postgresql://secret@db/hexlode',
      }),
    ).toEqual({
      posthogKey: 'phc_live',
      posthogHost: 'https://eu.i.posthog.com',
      sentryDsn: 'https://key@o1.ingest.sentry.io/2',
      appVersion: '1.4.0',
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

  // The page carries the config so the browser can start Sentry before it hydrates.
  it('reads the config back from the page, dropping anything unexpected', () => {
    const config = {
      posthogKey: 'phc_live',
      sentryDsn: 'https://key@o1.ingest.sentry.io/2',
      appVersion: '1.4.0',
    }
    expect(parsePublicConfigJson(JSON.stringify({ ...config, extra: 'x' }))).toEqual(config)
    expect(parsePublicConfigJson(JSON.stringify({ sentryDsn: 'not a url' }))).toEqual({})
    expect(parsePublicConfigJson('{broken')).toEqual({})
    expect(parsePublicConfigJson(null)).toEqual({})
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

// The server hands the browser its settings at runtime, so one image works with any keys.
describe('starting analytics and error reports', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.doUnmock('posthog-js')
    vi.doUnmock('@sentry/tanstackstart-react')
    vi.resetModules()
  })

  it('starts PostHog with the key and host from the public config', async () => {
    vi.stubGlobal('window', {})
    const init = vi.fn()
    vi.doMock('posthog-js', () => ({ default: { init, capture: vi.fn() } }))
    const { startAnalytics } = await import('#/features/usage/usage')
    await startAnalytics({ posthogKey: 'phc_runtime', posthogHost: 'https://eu.i.posthog.com' })
    expect(init).toHaveBeenCalledWith(
      'phc_runtime',
      expect.objectContaining({ api_host: 'https://eu.i.posthog.com' }),
    )
  })

  it('starts Sentry with the DSN from the public config', async () => {
    vi.stubGlobal('window', {})
    const init = vi.fn()
    vi.doMock('@sentry/tanstackstart-react', () => ({ init }))
    const { startErrorReporting } = await import('#/features/usage/error-reports')
    await startErrorReporting({ sentryDsn: 'https://key@o1.ingest.sentry.io/2' })
    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: 'https://key@o1.ingest.sentry.io/2' }),
    )
  })
})

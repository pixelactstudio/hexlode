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

  it('starts Sentry with the DSN and release from the public config, with logs and tracing', async () => {
    vi.stubGlobal('window', {})
    const init = vi.fn()
    vi.doMock('@sentry/tanstackstart-react', () => ({
      init,
      consoleLoggingIntegration: () => ({ name: 'ConsoleLogs' }),
    }))
    const { startErrorReporting } = await import('#/features/usage/error-reports')
    await startErrorReporting({
      sentryDsn: 'https://key@o1.ingest.sentry.io/2',
      appVersion: '1.4.0',
      environment: 'staging',
    })
    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://key@o1.ingest.sentry.io/2',
        release: '1.4.0',
        environment: 'staging',
        sendDefaultPii: false,
        enableLogs: true,
        tracesSampleRate: expect.any(Number),
      }),
    )
    const options = init.mock.calls[0][0]
    expect(options.tracesSampleRate).toBeGreaterThan(0)
    expect(options.replaysSessionSampleRate ?? 0).toBe(0)
    expect(options.beforeSendLog({ message: 'Lost a.jpg' })).toEqual({ message: 'Lost [file]' })
  })

  it('traces router navigations once Sentry has started', async () => {
    vi.stubGlobal('window', {})
    const addIntegration = vi.fn()
    const routerIntegration = vi.fn((router: unknown) => ({ name: 'Router', router }))
    vi.doMock('@sentry/tanstackstart-react', () => ({
      init: vi.fn(),
      addIntegration,
      consoleLoggingIntegration: () => ({ name: 'ConsoleLogs' }),
      tanstackRouterBrowserTracingIntegration: routerIntegration,
    }))
    const { startErrorReporting, traceRouter } = await import('#/features/usage/error-reports')
    const router = { isServer: false }
    const tracing = traceRouter(router as never)
    await startErrorReporting({ sentryDsn: 'https://key@o1.ingest.sentry.io/2' })
    await tracing
    expect(addIntegration).toHaveBeenCalledWith({ name: 'Router', router })
  })

  it('leaves router tracing off without a DSN', async () => {
    vi.stubGlobal('window', {})
    const addIntegration = vi.fn()
    vi.doMock('@sentry/tanstackstart-react', () => ({ init: vi.fn(), addIntegration }))
    const { startErrorReporting, traceRouter } = await import('#/features/usage/error-reports')
    const tracing = traceRouter({ isServer: false } as never)
    await startErrorReporting({})
    await tracing
    expect(addIntegration).not.toHaveBeenCalled()
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

// Content blockers stop the PostHog and Sentry libraries from loading. The app must carry on.
describe('when a content blocker stops the analytics libraries', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.doUnmock('posthog-js')
    vi.doUnmock('@sentry/tanstackstart-react')
    vi.resetModules()
  })

  it('starts analytics without throwing and keeps tracking harmless', async () => {
    vi.stubGlobal('window', {})
    vi.doMock('posthog-js', () => {
      throw new Error('Error loading dynamically imported module')
    })
    const { startAnalytics, track } = await import('#/features/usage/usage')
    await expect(startAnalytics({ posthogKey: 'phc_test' })).resolves.toBeUndefined()
    expect(() => track('quick_tool_opened', { tool: 'convert' })).not.toThrow()
  })

  it('starts error reports without throwing', async () => {
    vi.stubGlobal('window', {})
    vi.doMock('@sentry/tanstackstart-react', () => {
      throw new Error('Error loading dynamically imported module')
    })
    const { startErrorReporting } = await import('#/features/usage/error-reports')
    await expect(
      startErrorReporting({ sentryDsn: 'https://key@example.invalid/1' }),
    ).resolves.toBeUndefined()
  })
})

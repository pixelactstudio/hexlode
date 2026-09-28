import { describe, expect, it } from 'vitest'
import { chain } from '#/features/nodes/__tests__/harness'
import { productRegistry } from '#/features/nodes/registry'
import { pipelineShape } from '#/features/usage/pipeline-shape'
import { scrubSentryEvent, scrubSentryLog, scrubText } from '#/features/usage/scrub'
import { createAnalytics, POSTHOG_OPTIONS } from '#/features/usage/usage'

function fakePostHog() {
  const captured: { event: string; properties: Record<string, unknown> }[] = []
  const inits: { key: string; options: Record<string, unknown> }[] = []
  const registered: Record<string, unknown>[] = []
  return {
    captured,
    inits,
    registered,
    client: {
      init: (key: string, options: Record<string, unknown>) => inits.push({ key, options }),
      capture: (event: string, properties: Record<string, unknown>) =>
        captured.push({ event, properties }),
      register: (properties: Record<string, unknown>) => registered.push(properties),
    },
  }
}

describe('analytics', () => {
  it('starts PostHog as the TanStack Start guide shows, cookieless and without person profiles', () => {
    const posthog = fakePostHog()
    createAnalytics({ key: 'phc_test', host: 'https://eu.i.posthog.com', posthog: posthog.client })
    expect(posthog.inits).toHaveLength(1)
    const { options } = posthog.inits[0]
    expect(options).toMatchObject({
      api_host: 'https://eu.i.posthog.com',
      defaults: '2026-05-30',
      cookieless_mode: 'always',
      person_profiles: 'never',
      disable_session_recording: true,
    })
    // Pageviews, page leaves, clicks, heatmaps and web vitals are captured automatically.
    expect(options.capture_pageview).not.toBe(false)
    expect(options.autocapture).not.toBe(false)
    expect(options).toMatchObject({
      capture_heatmaps: true,
      capture_performance: { web_vitals: true },
    })
  })

  // File names are shown on screen, so autocapture records which element was used, never its text.
  it('keeps element text and attributes out of autocaptured events', () => {
    const posthog = fakePostHog()
    createAnalytics({ key: 'phc_test', posthog: posthog.client })
    expect(posthog.inits[0].options).toMatchObject({
      mask_all_text: true,
      mask_all_element_attributes: true,
      capture_exceptions: false,
    })
  })

  it('labels every event with the app version', () => {
    const posthog = fakePostHog()
    createAnalytics({ key: 'phc_test', appVersion: '1.4.0', posthog: posthog.client })
    expect(posthog.registered).toEqual([{ app_version: '1.4.0' }])
  })

  // PostHog hashes the IP into the daily cookieless ID and drops cookieless events without one.
  it('leaves the IP for PostHog to hash into the cookieless ID', () => {
    const options: Record<string, unknown> = POSTHOG_OPTIONS
    const beforeSend = options.before_send as ((event: unknown) => unknown) | undefined
    const event = { event: 'x', properties: { itemCount: 2 } }
    expect(beforeSend ? beforeSend(event) : event).toEqual(event)
  })

  it('does nothing without a key', () => {
    const posthog = fakePostHog()
    const analytics = createAnalytics({ posthog: posthog.client })
    analytics.track('quick_tool_opened', { tool: 'convert' })
    expect(posthog.inits).toHaveLength(0)
    expect(posthog.captured).toHaveLength(0)
  })

  it('sends events with allowed properties', () => {
    const posthog = fakePostHog()
    const analytics = createAnalytics({ key: 'k', posthog: posthog.client })
    analytics.track('run_finished', {
      surface: 'studio',
      status: 'complete',
      itemCount: 3,
      processed: 2,
      skipped: 1,
      failed: 0,
      cached: 0,
      durationMs: 1200,
      inputBytes: 10,
      outputBytes: 5,
      failureCodes: [],
      warningCodes: ['metadata_dropped'],
    })
    expect(posthog.captured.map(({ event }) => event)).toEqual(['run_finished'])
  })

  it('sends node removals, engine problems and colour mode changes', () => {
    const posthog = fakePostHog()
    const analytics = createAnalytics({ key: 'k', posthog: posthog.client })
    analytics.track('node_removed', { nodeType: 'resize', method: 'keyboard' })
    analytics.track('engine_unavailable', { reason: 'insecure' })
    analytics.track('colour_mode_changed', { mode: 'light' })
    expect(posthog.captured).toEqual([
      { event: 'node_removed', properties: { nodeType: 'resize', method: 'keyboard' } },
      { event: 'engine_unavailable', properties: { reason: 'insecure' } },
      { event: 'colour_mode_changed', properties: { mode: 'light' } },
    ])
  })

  it('refuses events carrying anything outside their schema, such as a file name', () => {
    const posthog = fakePostHog()
    const analytics = createAnalytics({ key: 'k', posthog: posthog.client })
    analytics.track('quick_tool_opened', { tool: 'convert', fileName: 'holiday.jpg' } as never)
    analytics.track('quick_tool_opened', { tool: 'my secret tool' } as never)
    expect(posthog.captured).toEqual([])
  })
})

describe('pipelineShape', () => {
  it('describes node types and settings but leaves out text the user typed', () => {
    const shape = pipelineShape(
      chain(['rename', { template: 'Holiday in Rome {name}' }], ['convert', { format: 'avif' }]),
      productRegistry,
    )
    expect(shape.nodeTypes).toEqual(['files', 'rename', 'convert', 'output'])
    expect(shape.connectionCount).toBe(3)
    const serialised = JSON.stringify(shape)
    expect(serialised).not.toContain('Rome')
    expect(serialised).not.toContain('hexlode"')
    expect(shape.nodes.find((node) => node.type === 'convert')?.settings).toMatchObject({
      format: 'avif',
      avif: { quality: 60 },
    })
  })
})

describe('scrub', () => {
  it('removes file names and paths from text', () => {
    expect(scrubText('Could not decode "IMG 2041 (copy).HEIC" in /Users/ada/Trip/beach.jpg')).toBe(
      'Could not decode "[file]" in [path]',
    )
    expect(scrubText('photo-2.webp could not be made smaller than 12 KB.')).toBe(
      '[file] could not be made smaller than 12 KB.',
    )
  })

  it('scrubs Sentry messages, exceptions and breadcrumbs', () => {
    const event = scrubSentryEvent({
      message: 'Failed on cat.png',
      exception: { values: [{ type: 'Error', value: 'Decoding a.jpg failed' }] },
      breadcrumbs: [{ message: 'dropped b.avif' }],
      user: { email: 'ada@example.com' },
    })
    expect(event).toEqual({
      message: 'Failed on [file]',
      exception: { values: [{ type: 'Error', value: 'Decoding [file] failed' }] },
      breadcrumbs: [{ message: 'dropped [file]' }],
    })
  })

  it('scrubs Sentry log messages and their attributes', () => {
    const log = scrubSentryLog({
      level: 'warn',
      message: 'Could not read cat.png',
      attributes: { 'sentry.message.parameter.0': 'dog.webp', count: 2 },
    })
    expect(log).toEqual({
      level: 'warn',
      message: 'Could not read [file]',
      attributes: { 'sentry.message.parameter.0': '[file]', count: 2 },
    })
  })
})

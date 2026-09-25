import { describe, expect, it } from 'vitest'

import { createAnalytics, POSTHOG_OPTIONS } from '#/features/analytics/analytics'
import { pipelineShape } from '#/features/analytics/pipeline-shape'
import { scrubSentryEvent, scrubText } from '#/features/analytics/scrub'
import { chain } from '#/features/nodes/__tests__/harness'
import { productRegistry } from '#/features/nodes/registry'

function fakePostHog() {
  const captured: { event: string; properties: Record<string, unknown> }[] = []
  const inits: { key: string; options: Record<string, unknown> }[] = []
  return {
    captured,
    inits,
    client: {
      init: (key: string, options: Record<string, unknown>) => inits.push({ key, options }),
      capture: (event: string, properties: Record<string, unknown>) =>
        captured.push({ event, properties }),
    },
  }
}

describe('analytics', () => {
  it('starts PostHog cookieless, without person profiles, autocapture or replay', () => {
    const posthog = fakePostHog()
    createAnalytics({ key: 'phc_test', host: 'https://eu.i.posthog.com', posthog: posthog.client })
    expect(posthog.inits).toHaveLength(1)
    expect(posthog.inits[0].options).toMatchObject({
      api_host: 'https://eu.i.posthog.com',
      cookieless_mode: 'always',
      person_profiles: 'never',
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      persistence: 'memory',
    })
  })

  it('removes the IP address from every event', () => {
    const beforeSend = POSTHOG_OPTIONS.before_send
    const event = beforeSend({ event: 'x', properties: { $ip: '203.0.113.9', itemCount: 2 } })
    expect(event?.properties).toEqual({ $ip: null, itemCount: 2 })
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
})

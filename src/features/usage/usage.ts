/**
 * The only way the app sends product analytics. PostHog runs cookieless, without person profiles,
 * autocapture or session replay. Each event is checked against its schema before it is sent.
 */
import { type AnalyticsEventName, EVENTS, type EventProperties } from '#/features/usage/events'
import type { PublicConfig } from '#/features/usage/types'

export interface PostHogLike {
  init(key: string, options: Record<string, unknown>): unknown
  capture(event: string, properties: Record<string, unknown>): unknown
}

export const POSTHOG_OPTIONS = {
  cookieless_mode: 'always',
  person_profiles: 'never',
  persistence: 'memory',
  disable_persistence: true,
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: false,
  capture_heatmaps: false,
  capture_dead_clicks: false,
  capture_exceptions: false,
  capture_performance: false,
  rageclick: false,
  disable_session_recording: true,
  disable_surveys: true,
  disable_product_tours: true,
  disable_web_experiments: true,
  disable_external_dependency_loading: true,
  advanced_disable_flags: true,
  mask_personal_data_properties: true,
} as const

export interface AnalyticsOptions {
  key?: string
  host?: string
  posthog: PostHogLike
}

export function createAnalytics({ key, host, posthog }: AnalyticsOptions) {
  const enabled = Boolean(key)
  if (key) {
    posthog.init(key, { ...POSTHOG_OPTIONS, api_host: host || 'https://us.i.posthog.com' })
  }
  return {
    track<E extends AnalyticsEventName>(event: E, properties: EventProperties<E>) {
      if (!enabled) return
      const parsed = EVENTS[event].properties.safeParse(properties)
      if (!parsed.success) {
        if (import.meta.env?.DEV)
          console.warn(`Analytics event ${event} was not sent: invalid properties.`)
        return
      }
      posthog.capture(event, parsed.data as Record<string, unknown>)
    },
  }
}

export type Analytics = ReturnType<typeof createAnalytics>

let instance: Analytics | undefined
let starting: Promise<void> | undefined
const queued: [AnalyticsEventName, unknown][] = []

/** Starts analytics once, in the browser. Without a PostHog key it does nothing. */
export function startAnalytics(config: PublicConfig) {
  if (typeof window === 'undefined') return Promise.resolve()
  starting ??= (async () => {
    const key = config.posthogKey
    if (key) {
      try {
        const { default: posthog } = await import('posthog-js')
        instance = createAnalytics({
          key,
          host: config.posthogHost,
          posthog: posthog as unknown as PostHogLike,
        })
      } catch {
        // A content blocker stopped PostHog. The app works the same without analytics.
      }
    }
    for (const [event, properties] of queued.splice(0)) {
      instance?.track(event, properties as never)
    }
  })()
  return starting
}

export function track<E extends AnalyticsEventName>(event: E, properties: EventProperties<E>) {
  if (instance) instance.track(event, properties)
  else if (typeof window !== 'undefined' && queued.length < 50) queued.push([event, properties])
}

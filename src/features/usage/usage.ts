/**
 * The only way the app sends product analytics. PostHog starts as its TanStack Start guide shows,
 * in cookieless mode and without person profiles. It captures pageviews, page leaves, clicks,
 * heatmaps and web vitals by itself, with element text and attributes masked because file names are
 * shown on screen. Session replay stays off. The app's own events are checked against their schema
 * before they are sent.
 */
import { DEFAULT_POSTHOG_HOST, POSTHOG_DEFAULTS } from '#/features/usage/constants'
import { type AnalyticsEventName, EVENTS, type EventProperties } from '#/features/usage/events'
import type { PublicConfig } from '#/features/usage/types'

export interface PostHogLike {
  init(key: string, options: Record<string, unknown>): unknown
  capture(event: string, properties: Record<string, unknown>): unknown
  register(properties: Record<string, unknown>): unknown
}

export const POSTHOG_OPTIONS = {
  defaults: POSTHOG_DEFAULTS,
  cookieless_mode: 'always',
  person_profiles: 'never',
  mask_all_text: true,
  mask_all_element_attributes: true,
  capture_heatmaps: true,
  capture_performance: { web_vitals: true },
  // Sentry reports errors, with file names removed first.
  capture_exceptions: false,
  disable_session_recording: true,
} as const

export interface AnalyticsOptions {
  key?: string
  host?: string
  appVersion?: string
  environment?: string
  posthog: PostHogLike
}

export function createAnalytics({ key, host, appVersion, environment, posthog }: AnalyticsOptions) {
  const enabled = Boolean(key)
  if (key) {
    posthog.init(key, { ...POSTHOG_OPTIONS, api_host: host || DEFAULT_POSTHOG_HOST })
    // PostHog's test account filter hides every environment but production from dashboards.
    const labels = { app_version: appVersion, environment }
    const defined = Object.fromEntries(Object.entries(labels).filter(([, value]) => value))
    if (Object.keys(defined).length > 0) posthog.register(defined)
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
          appVersion: config.appVersion,
          environment: config.environment,
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

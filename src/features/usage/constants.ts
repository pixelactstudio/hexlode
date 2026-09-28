/** The page meta tag the server writes the public settings into, for the browser to read early. */
export const PUBLIC_CONFIG_META = 'hexlode-config'

/** PostHog's recommended defaults as of this date, as its TanStack Start guide sets them. */
export const POSTHOG_DEFAULTS = '2026-05-30'

/** An environment name such as `staging`: lowercase letters, digits and dashes. */
export const ENVIRONMENT_PATTERN = /^[a-z][a-z0-9-]{0,31}$/

export const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com'

/**
 * The share of page loads, navigations and server requests Sentry traces. A fifth keeps a steady
 * view of performance across the month within the free plan's span quota.
 */
export const TRACES_SAMPLE_RATE = 0.2

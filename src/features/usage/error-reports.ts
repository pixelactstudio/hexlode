/**
 * Error reports, logs and performance tracing, set up as Sentry's TanStack Start guide shows but
 * started from the settings the server hands the page. Sentry runs without personal data or
 * replay; file names are removed from messages, exceptions, breadcrumbs and logs before sending.
 */
import type { AnyRouter } from '@tanstack/react-router'

import { TRACES_SAMPLE_RATE } from '#/features/usage/constants'
import { scrubSentryEvent, scrubSentryLog, scrubText } from '#/features/usage/scrub'
import type { PublicConfig } from '#/features/usage/types'

type SentryModule = typeof import('@sentry/tanstackstart-react')

let started = false
let markReady: (sentry: SentryModule | undefined) => void = () => {}
/** Settles once Sentry has started, or with nothing when it is off or blocked. */
const ready = new Promise<SentryModule | undefined>((resolve) => {
  markReady = resolve
})

export async function startErrorReporting(config: PublicConfig) {
  if (started || typeof window === 'undefined') return
  started = true
  const dsn = config.sentryDsn
  if (!dsn) return markReady(undefined)
  let Sentry: SentryModule
  try {
    Sentry = await import('@sentry/tanstackstart-react')
  } catch {
    // A content blocker stopped Sentry. The app works the same without error reports.
    return markReady(undefined)
  }
  Sentry.init({
    dsn,
    release: config.appVersion,
    environment: config.environment ?? (import.meta.env?.PROD ? 'production' : 'development'),
    sendDefaultPii: false,
    enableLogs: true,
    tracesSampleRate: TRACES_SAMPLE_RATE,
    integrations: [Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] })],
    beforeSend: (event) => scrubSentryEvent(event),
    beforeSendLog: (log) => scrubSentryLog(log),
    beforeBreadcrumb: (breadcrumb) => {
      if (breadcrumb.category === 'console' || breadcrumb.category?.startsWith('ui.')) return null
      return breadcrumb.message
        ? { ...breadcrumb, message: scrubText(breadcrumb.message) }
        : breadcrumb
    },
  })
  markReady(Sentry)
}

/** Traces page loads and navigations by route once Sentry has started in the browser. */
export async function traceRouter(router: AnyRouter) {
  if (router.isServer) return
  const Sentry = await ready
  Sentry?.addIntegration(Sentry.tanstackRouterBrowserTracingIntegration(router))
}

/**
 * Error reports. Sentry runs without personal data or replay; file names are removed from
 * messages, exceptions and breadcrumbs before sending.
 */
import { scrubSentryEvent, scrubText } from '#/features/analytics/scrub'

let started = false

export async function startErrorReporting() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  if (started || !dsn || typeof window === 'undefined') return
  started = true
  const Sentry = await import('@sentry/tanstackstart-react')
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend: (event) => scrubSentryEvent(event),
    beforeBreadcrumb: (breadcrumb) => {
      if (breadcrumb.category === 'console' || breadcrumb.category?.startsWith('ui.')) return null
      return breadcrumb.message
        ? { ...breadcrumb, message: scrubText(breadcrumb.message) }
        : breadcrumb
    },
  })
}

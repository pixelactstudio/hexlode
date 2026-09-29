import * as Sentry from '@sentry/tanstackstart-react'

const sentryDsn = import.meta.env?.VITE_SENTRY_DSN ?? process.env.VITE_SENTRY_DSN

/**
 * The server starts no aborts of its own, so an AbortError means the browser went away before its
 * request was read, such as a tab closing while it sent an error report through the tunnel.
 */
function isClientDisconnect(error) {
  // A few causes deep at most, in case a chain of causes loops.
  for (let current = error, depth = 0; current && depth < 5; current = current.cause, depth++) {
    if (current.name === 'AbortError') return true
  }
  return false
}

/**
 * Span attributes that hold the visitor's IP address. Sentry copies the first X-Forwarded-For
 * address, which the proxy in front of the server sets, into every request span even without
 * personal data, and analytics must not keep IP addresses (ADR 0005).
 */
const IP_ATTRIBUTES = ['http.client_ip', 'client.address']

function withoutIp(span) {
  for (const key of IP_ATTRIBUTES) delete span.data?.[key]
  return span
}

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    release: process.env.HEXLODE_VERSION,
    // Matches the environment src/features/usage/validators.ts hands the browser.
    environment: /^[a-z][a-z0-9-]{0,31}$/.test(process.env.HEXLODE_ENVIRONMENT ?? '')
      ? process.env.HEXLODE_ENVIRONMENT
      : process.env.NODE_ENV === 'production'
        ? 'production'
        : 'development',
    sendDefaultPii: false,
    dataCollection: {
      userInfo: false,
      httpBodies: [],
    },
    enableLogs: true,
    // Matches TRACES_SAMPLE_RATE in src/features/usage/constants.ts.
    tracesSampleRate: 0.2,
    beforeSendSpan: withoutIp,
    beforeSend: (event, hint) => (isClientDisconnect(hint.originalException) ? null : event),
  })
}

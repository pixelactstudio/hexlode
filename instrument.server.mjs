import * as Sentry from '@sentry/tanstackstart-react'

const sentryDsn = import.meta.env?.VITE_SENTRY_DSN ?? process.env.VITE_SENTRY_DSN

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
  })
}

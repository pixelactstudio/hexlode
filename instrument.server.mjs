import * as Sentry from '@sentry/tanstackstart-react'

const sentryDsn = import.meta.env?.VITE_SENTRY_DSN ?? process.env.VITE_SENTRY_DSN

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    sendDefaultPii: false,
    dataCollection: {
      userInfo: false,
      httpBodies: [],
    },
    tracesSampleRate: 0,
  })
}

import { StartClient } from '@tanstack/react-start/client'
import { StrictMode, startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'

import { PUBLIC_CONFIG_META } from '#/features/usage/constants'
import { startErrorReporting } from '#/features/usage/error-reports'
import { startAnalytics } from '#/features/usage/usage'
import { parsePublicConfigJson } from '#/features/usage/validators'

// Sentry and PostHog start before hydration, as their guides ask, from the settings the server
// wrote into the page. They load on their own, so a content blocker cannot stop the app.
const config = parsePublicConfigJson(
  document.querySelector(`meta[name="${PUBLIC_CONFIG_META}"]`)?.getAttribute('content'),
)
void startErrorReporting(config)
void startAnalytics(config)

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  )
})

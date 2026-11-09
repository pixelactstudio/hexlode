import { createFileRoute, redirect } from '@tanstack/react-router'

import { SITE_NAME } from '#/features/seo/constants'

/**
 * The offline app shell (ADR 0015). The server renders only the root route here, the frame without
 * a page, because the route opts out of server rendering. The service worker keeps this page and
 * serves it offline for any page it has no copy of, such as a pipeline tool; the router then
 * renders that page in the browser. Opened directly, it sends the visitor home.
 */
export const Route = createFileRoute('/app-shell')({
  ssr: false,
  head: () => ({
    meta: [{ title: SITE_NAME }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  beforeLoad: () => {
    throw redirect({ to: '/', replace: true })
  },
})

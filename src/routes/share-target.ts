import { createFileRoute } from '@tanstack/react-router'

import { SHARE_PAGE } from '#/features/handover/constants'

export const Route = createFileRoute('/share-target')({
  server: {
    handlers: {
      // The service worker answers shares on the device. A share only reaches the server when the
      // worker is missing, such as after the site's data was cleared; the photos are not read or
      // kept, and Strip metadata opens empty for the user to add them again.
      POST: () => new Response(null, { status: 303, headers: { location: SHARE_PAGE } }),
    },
  },
})

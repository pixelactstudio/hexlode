import { createFileRoute } from '@tanstack/react-router'

import { getAuth } from '#/lib/auth'

const notConfigured = () => new Response('Accounts are not enabled.', { status: 404 })

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => getAuth()?.handler(request) ?? notConfigured(),
      POST: ({ request }) => getAuth()?.handler(request) ?? notConfigured(),
    },
  },
})

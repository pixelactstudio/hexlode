import { createFileRoute } from '@tanstack/react-router'

import { modelServer } from '#/features/background-removal/model-server'

/**
 * On-device models, served by Hexlode itself (ADR 0017). The browser downloads one only after the
 * person agreed, and checks it again before keeping it.
 */
export const Route = createFileRoute('/models/$file')({
  server: {
    handlers: {
      GET: ({ params, request }) => modelServer().respond(params.file, request),
    },
  },
})

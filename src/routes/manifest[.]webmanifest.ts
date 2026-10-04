import { createFileRoute } from '@tanstack/react-router'

import { webManifest } from '#/features/seo/files'

export const Route = createFileRoute('/manifest.webmanifest')({
  server: {
    handlers: {
      GET: () =>
        Response.json(webManifest(), {
          headers: {
            'content-type': 'application/manifest+json; charset=utf-8',
            'cache-control': 'public, max-age=3600',
          },
        }),
    },
  },
})

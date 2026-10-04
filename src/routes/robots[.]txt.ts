import { createFileRoute } from '@tanstack/react-router'

import { robotsTxt } from '#/features/seo/files'
import { parsePublicConfig } from '#/features/usage/validators'

/** Read per request, so the staging deployment's `HEXLODE_ENVIRONMENT` keeps crawlers out. */
export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () => {
        const { environment } = parsePublicConfig({
          HEXLODE_ENVIRONMENT: process.env.HEXLODE_ENVIRONMENT,
          NODE_ENV: process.env.NODE_ENV,
        })
        return new Response(robotsTxt({ indexable: environment === 'production' }), {
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})

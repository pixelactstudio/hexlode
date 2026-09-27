import { createFileRoute } from '@tanstack/react-router'

/**
 * For container health checks: Dokploy moves traffic to a new container once this answers.
 * `HEXLODE_VERSION` is set when the image is built.
 */
export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          { status: 'ok', version: process.env.HEXLODE_VERSION ?? 'dev' },
          { headers: { 'cache-control': 'no-store' } },
        ),
    },
  },
})

import { LinkProvider } from '@astryxdesign/core/Link'
import { Theme } from '@astryxdesign/core/theme'
import { neutralTheme } from '@astryxdesign/theme-neutral/built'
import { TanStackDevtools } from '@tanstack/react-devtools'
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, HeadContent, Scripts } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'

import { useEffect } from 'react'

import { startAnalytics } from '#/features/analytics/analytics'
import { startErrorReporting } from '#/features/analytics/sentry'
import { RouterLink } from '#/lib/router-link'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import appCss from '../styles.css?url'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Hexlode — Image tools that run on your device',
      },
      {
        name: 'description',
        content:
          'Convert, compress, resize and strip metadata from images in your browser, or build batch pipelines in the Studio. Images never leave your device.',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      { rel: 'icon', href: '/hexlode-mark.svg', type: 'image/svg+xml' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void startAnalytics()
    void startErrorReporting()
  }, [])
  return (
    <html lang="en" data-astryx-theme="neutral">
      <head>
        <HeadContent />
      </head>
      <body>
        <Theme theme={neutralTheme}>
          <LinkProvider component={RouterLink}>{children}</LinkProvider>
        </Theme>
        {import.meta.env.DEV ? (
          <TanStackDevtools
            config={{ position: 'bottom-right', hideUntilHover: true }}
            plugins={[
              { name: 'Tanstack Router', render: <TanStackRouterDevtoolsPanel /> },
              TanStackQueryDevtools,
            ]}
          />
        ) : null}
        <Scripts />
      </body>
    </html>
  )
}

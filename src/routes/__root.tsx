import { LinkProvider } from '@astryxdesign/core/Link'
import { Theme } from '@astryxdesign/core/theme'
import { TanStackDevtools } from '@tanstack/react-devtools'
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, HeadContent, Scripts } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'

import { SiteFrame } from '#/features/app-shell/site-frame'
import { COLOUR_MODE_SCRIPT } from '#/features/theme/colour-mode'
import { useColourMode } from '#/features/theme/colour-mode-menu'
import { DEFAULT_COLOUR_MODE } from '#/features/theme/constants'
import { hexlodeTheme } from '#/features/theme/hexlode'
import { PUBLIC_CONFIG_META } from '#/features/usage/constants'
import { getPublicConfig } from '#/features/usage/public-config'
import { RouterLink } from '#/lib/router-link'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import appCss from '../styles.css?url'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  // Read once per visit on the server, so the deployment's environment sets the keys.
  loader: () => getPublicConfig(),
  staleTime: Number.POSITIVE_INFINITY,
  head: ({ loaderData }) => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Hexlode — Image pipelines that run in your browser',
      },
      {
        name: 'description',
        content:
          'Convert, compress, resize, crop and clean images in your browser, or build batch pipelines in the Studio. Works on your device, with no upload needed.',
      },
      // src/client.tsx reads this to start analytics and error reports before hydration.
      { name: PUBLIC_CONFIG_META, content: JSON.stringify(loaderData ?? {}) },
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
  const mode = useColourMode()
  return (
    // The inline script sets the colour mode before paint, so the attribute can differ from the
    // server's default.
    <html
      lang="en"
      data-astryx-theme="hexlode"
      data-colour-mode={DEFAULT_COLOUR_MODE}
      suppressHydrationWarning
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed script from our own constants, needed before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: COLOUR_MODE_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        <Theme theme={hexlodeTheme} mode={mode}>
          <LinkProvider component={RouterLink}>
            <SiteFrame>{children}</SiteFrame>
          </LinkProvider>
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

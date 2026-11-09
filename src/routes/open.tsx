import { createFileRoute } from '@tanstack/react-router'

import { OpenPage } from '#/features/handover/open-page'
import { SITE_NAME, TITLE_SEPARATOR } from '#/features/seo/constants'

export const Route = createFileRoute('/open')({
  // Where the installed app opens files from the file manager. There is nothing here to index.
  head: () => ({
    meta: [
      { title: `Open images${TITLE_SEPARATOR}${SITE_NAME}` },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: OpenPage,
})

import { createFileRoute } from '@tanstack/react-router'

import { QuickToolPage } from '#/features/quick-tools/quick-tool-page'
import { breadcrumbData, pageHead } from '#/features/seo/head'

export const Route = createFileRoute('/resize')({
  head: () => {
    const { meta, links } = pageHead('resize')
    return { meta: [...meta, { 'script:ld+json': breadcrumbData('resize') }], links }
  },
  component: () => <QuickToolPage tool="resize" />,
})

import { createFileRoute } from '@tanstack/react-router'

import { QuickToolPage } from '#/features/quick-tools/quick-tool-page'
import { breadcrumbData, pageHead } from '#/features/seo/head'

export const Route = createFileRoute('/rotate')({
  head: () => {
    const { meta, links } = pageHead('rotate')
    return { meta: [...meta, { 'script:ld+json': breadcrumbData('rotate') }], links }
  },
  component: () => <QuickToolPage tool="rotate" />,
})

import { createFileRoute } from '@tanstack/react-router'

import { QuickToolPage } from '#/features/quick-tools/quick-tool-page'
import { breadcrumbData, pageHead } from '#/features/seo/head'

export const Route = createFileRoute('/strip-metadata')({
  head: () => {
    const { meta, links } = pageHead('strip-metadata')
    return { meta: [...meta, { 'script:ld+json': breadcrumbData('strip-metadata') }], links }
  },
  component: () => <QuickToolPage tool="strip-metadata" />,
})

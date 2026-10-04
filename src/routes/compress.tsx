import { createFileRoute } from '@tanstack/react-router'

import { QuickToolPage } from '#/features/quick-tools/quick-tool-page'
import { breadcrumbData, pageHead } from '#/features/seo/head'

export const Route = createFileRoute('/compress')({
  head: () => {
    const { meta, links } = pageHead('compress')
    return { meta: [...meta, { 'script:ld+json': breadcrumbData('compress') }], links }
  },
  component: () => <QuickToolPage tool="compress" />,
})

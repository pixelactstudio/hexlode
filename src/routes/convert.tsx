import { createFileRoute } from '@tanstack/react-router'

import { QuickToolPage } from '#/features/quick-tools/quick-tool-page'
import { breadcrumbData, pageHead } from '#/features/seo/head'

export const Route = createFileRoute('/convert')({
  head: () => {
    const { meta, links } = pageHead('convert')
    return { meta: [...meta, { 'script:ld+json': breadcrumbData('convert') }], links }
  },
  component: () => <QuickToolPage tool="convert" />,
})

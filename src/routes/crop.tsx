import { createFileRoute } from '@tanstack/react-router'

import { QuickToolPage } from '#/features/quick-tools/quick-tool-page'
import { breadcrumbData, pageHead } from '#/features/seo/head'

export const Route = createFileRoute('/crop')({
  head: () => {
    const { meta, links } = pageHead('crop')
    return { meta: [...meta, { 'script:ld+json': breadcrumbData('crop') }], links }
  },
  component: () => <QuickToolPage tool="crop" />,
})

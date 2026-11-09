import { createFileRoute } from '@tanstack/react-router'

import { QuickToolPage } from '#/features/quick-tools/quick-tool-page'
import { breadcrumbData, pageHead } from '#/features/seo/head'

export const Route = createFileRoute('/remove-background')({
  head: () => {
    const { meta, links } = pageHead('remove-background')
    return { meta: [...meta, { 'script:ld+json': breadcrumbData('remove-background') }], links }
  },
  component: () => <QuickToolPage tool="remove-background" />,
})

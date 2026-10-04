import { createFileRoute } from '@tanstack/react-router'

import { PrivacyPage } from '#/features/privacy/privacy-page'
import { pageHead } from '#/features/seo/head'
import { usePageView } from '#/features/usage/use-page-view'

export const Route = createFileRoute('/privacy')({
  head: () => pageHead('privacy'),
  component: Privacy,
})

function Privacy() {
  usePageView({ page: 'privacy' })
  return <PrivacyPage />
}

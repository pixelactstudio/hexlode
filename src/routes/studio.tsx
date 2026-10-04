import { createFileRoute } from '@tanstack/react-router'

import { pageHead } from '#/features/seo/head'
import { StudioPage } from '#/features/studio/studio-page'

export const Route = createFileRoute('/studio')({
  head: () => pageHead('studio'),
  validateSearch: (search: Record<string, unknown>) => ({
    pipeline: typeof search.pipeline === 'string' ? search.pipeline : undefined,
  }),
  component: StudioRoute,
})

function StudioRoute() {
  const { pipeline } = Route.useSearch()
  return <StudioPage savedPipelineId={pipeline} />
}

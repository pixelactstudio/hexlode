import { createFileRoute } from '@tanstack/react-router'

import { StudioPage } from '#/features/studio/studio-page'

export const Route = createFileRoute('/studio')({
  head: () => ({ meta: [{ title: 'Studio — Hexlode' }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    pipeline: typeof search.pipeline === 'string' ? search.pipeline : undefined,
  }),
  component: StudioRoute,
})

function StudioRoute() {
  const { pipeline } = Route.useSearch()
  return <StudioPage savedPipelineId={pipeline} />
}

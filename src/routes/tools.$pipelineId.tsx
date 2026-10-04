import { createFileRoute } from '@tanstack/react-router'

import { PipelineToolPage } from '#/features/pipeline-tools/pipeline-tool-page'
import { SITE_NAME, TITLE_SEPARATOR } from '#/features/seo/constants'

export const Route = createFileRoute('/tools/$pipelineId')({
  // A saved pipeline lives in one visitor's browser, so there is nothing here to index.
  head: () => ({
    meta: [
      { title: `Pipeline tool${TITLE_SEPARATOR}${SITE_NAME}` },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: PipelineToolRoute,
})

function PipelineToolRoute() {
  const { pipelineId } = Route.useParams()
  return <PipelineToolPage pipelineId={pipelineId} />
}

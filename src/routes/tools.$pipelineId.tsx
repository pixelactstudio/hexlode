import { createFileRoute } from '@tanstack/react-router'

import { PipelineToolPage } from '#/features/pipeline-tools/pipeline-tool-page'

export const Route = createFileRoute('/tools/$pipelineId')({
  head: () => ({ meta: [{ title: 'Pipeline tool — Hexlode' }] }),
  component: PipelineToolRoute,
})

function PipelineToolRoute() {
  const { pipelineId } = Route.useParams()
  return <PipelineToolPage pipelineId={pipelineId} />
}

import { createFileRoute } from '@tanstack/react-router'

import { BuiltInToolPage } from '#/features/built-in-tools/built-in-tool-page'
import { builtInTool, isBuiltInToolSlug } from '#/features/built-in-tools/tools'
import { PipelineToolPage } from '#/features/pipeline-tools/pipeline-tool-page'
import { breadcrumbData, pageHead } from '#/features/seo/head'

export const Route = createFileRoute('/tools/$pipelineId')({
  head: ({ params }) => {
    if (isBuiltInToolSlug(params.pipelineId)) {
      const { meta, links } = pageHead(params.pipelineId)
      return {
        meta: [...meta, { 'script:ld+json': breadcrumbData(params.pipelineId) }],
        links,
      }
    }
    // A saved pipeline lives in one browser, so its address means nothing to search engines.
    return { meta: [{ title: 'Your tool | Hexlode' }, { name: 'robots', content: 'noindex' }] }
  },
  component: ToolRoute,
})

function ToolRoute() {
  const { pipelineId } = Route.useParams()
  const tool = builtInTool(pipelineId)
  return tool ? <BuiltInToolPage tool={tool} /> : <PipelineToolPage pipelineId={pipelineId} />
}

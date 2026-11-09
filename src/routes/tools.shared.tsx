import { createFileRoute } from '@tanstack/react-router'

import { SharedPipelineToolPage } from '#/features/pipeline-tools/shared-pipeline-tool-page'

export const Route = createFileRoute('/tools/shared')({
  // The pipeline lives after the `#`, which never reaches the server, so there is nothing to list.
  head: () => ({
    meta: [{ title: 'Shared tool | Hexlode' }, { name: 'robots', content: 'noindex' }],
  }),
  component: SharedPipelineToolPage,
})

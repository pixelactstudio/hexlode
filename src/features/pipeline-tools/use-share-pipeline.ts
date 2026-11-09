import { useToast } from '@astryxdesign/core/Toast'

import { PipelineLinkTooLong, pipelineLinkUrl } from '#/features/pipelines/pipeline-link'
import type { NamedPipeline } from '#/features/pipelines/types'
import { track } from '#/features/usage/usage'

/** Copies a pipeline link for a pipeline and says how it went. */
export function useSharePipeline() {
  const showToast = useToast()
  return async (named: NamedPipeline) => {
    const nodeCount = named.pipeline.nodes.length
    let url: string
    try {
      url = await pipelineLinkUrl(window.location.origin, named)
    } catch (reason) {
      const tooLong = reason instanceof PipelineLinkTooLong
      showToast({
        body: tooLong ? reason.message : 'The link could not be made.',
        type: 'error',
        uniqueID: 'pipeline-link',
      })
      track('pipeline_link', {
        action: 'copy',
        result: 'error',
        nodeCount,
        errorCode: tooLong ? 'too_long' : 'unknown',
      })
      return
    }
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      showToast({
        body: 'The browser did not allow copying. Try again, or export the .hexlode file.',
        type: 'error',
        uniqueID: 'pipeline-link',
      })
      track('pipeline_link', { action: 'copy', result: 'error', nodeCount, errorCode: 'clipboard' })
      return
    }
    showToast({
      body: 'Link copied. Anyone who opens it gets this pipeline as a tool; images are not in it.',
      uniqueID: 'pipeline-link',
    })
    track('pipeline_link', { action: 'copy', result: 'ok', nodeCount })
  }
}

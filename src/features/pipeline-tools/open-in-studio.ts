import { draftStore } from '#/features/pipelines/draft'
import type { NamedPipeline } from '#/features/pipelines/types'

/**
 * Makes a pipeline this tab's Studio draft, unsaved, so `/studio` opens it. Call it right before
 * going to the Studio.
 */
export function openInStudio(named: NamedPipeline) {
  draftStore().write({ name: named.name, pipeline: named.pipeline, savedId: null, dirty: true })
}

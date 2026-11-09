import type { Segmenter } from '#/features/background-removal/types'
import type { NodeContext } from '#/features/engine/types'

/** The segmenter the engine gave this node, which runs the model on the inference worker. */
export function segmenterOf(context: NodeContext) {
  const segmenter = context.services.segmenter as Segmenter | undefined
  if (!segmenter) throw new Error('Background removal is not available here.')
  return segmenter
}

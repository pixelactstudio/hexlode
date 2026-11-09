import type { NodeRegistry, Pipeline } from '#/features/engine/types'

/** IDs of the on-device models a pipeline's nodes run, each once. */
export function modelsOf(pipeline: Pick<Pipeline, 'nodes'>, registry: NodeRegistry) {
  return [...new Set(pipeline.nodes.flatMap((node) => registry.get(node.type)?.models ?? []))]
}

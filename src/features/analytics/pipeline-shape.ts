import type { PipelineShape } from '#/features/analytics/events'
import type { NodeRegistry, Pipeline } from '#/features/engine/types'

const SAFE_STRING = /^[a-z0-9.:-]{0,24}$/i

/** Keeps numbers, booleans and short identifier-like strings. Drops anything else. */
function sanitise(value: unknown): unknown {
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'string') return SAFE_STRING.test(value) ? value : undefined
  if (Array.isArray(value)) return value.map(sanitise).filter((entry) => entry !== undefined)
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([key, entry]) => [key, sanitise(entry)] as const)
      .filter(([, entry]) => entry !== undefined)
    return Object.fromEntries(entries)
  }
  return undefined
}

/** The shape and settings of a pipeline, without any text the user typed. */
export function pipelineShape(pipeline: Pipeline, registry: NodeRegistry): PipelineShape {
  return {
    nodeCount: pipeline.nodes.length,
    connectionCount: pipeline.connections.length,
    nodeTypes: pipeline.nodes.map((node) => node.type),
    nodes: pipeline.nodes.map((node) => {
      const definition = registry.get(node.type)
      let settings: Record<string, unknown> = {}
      try {
        settings = definition ? definition.parseSettings(node.settings) : {}
      } catch {
        settings = {}
      }
      const visible = Object.fromEntries(
        Object.entries(settings).filter(([key]) => !definition?.privateSettings?.includes(key)),
      )
      return { type: node.type, settings: sanitise(visible) as Record<string, unknown> }
    }),
  }
}

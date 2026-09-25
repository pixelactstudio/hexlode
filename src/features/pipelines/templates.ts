import type { NodeRegistry, Pipeline } from '#/features/engine/types'
import type { Template } from '#/features/pipelines/types'

function line(nodes: [id: string, type: string, settings?: Record<string, unknown>][]): Pipeline {
  return {
    nodes: nodes.map(([id, type, settings], index) => ({
      id,
      type,
      settings: settings ?? {},
      position: { x: index * 280, y: 120 },
    })),
    connections: nodes.slice(1).map(([id], index) => ({
      id: `${nodes[index][0]}-out-${id}`,
      source: nodes[index][0],
      sourcePort: 'out',
      target: id,
    })),
  }
}

/** Every template. The picker shows those whose nodes all exist in the registry. */
export const TEMPLATES: Template[] = [
  {
    id: 'web-ready-photos',
    name: 'Web-ready photos',
    description:
      'Turns photos upright, fits them in 2048 pixels, keeps only copyright and saves WebP.',
    pipeline: line([
      ['files', 'files'],
      ['rotate', 'rotate', { auto: true }],
      ['resize', 'resize', { mode: 'longestEdge', longestEdge: 2048 }],
      ['strip', 'strip-metadata', { mode: 'copyright' }],
      ['convert', 'convert', { format: 'webp', webp: { quality: 80 } }],
      ['output', 'output'],
    ]),
  },
  {
    id: 'blank',
    name: 'Blank',
    description: 'Starts with a Files node. Add the nodes you need.',
    pipeline: line([['files', 'files']]),
  },
]

export function availableTemplates(registry: NodeRegistry) {
  return TEMPLATES.filter((template) =>
    template.pipeline.nodes.every((node) => registry.get(node.type)),
  )
}

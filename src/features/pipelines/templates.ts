import type { NodeRegistry, Pipeline, PipelineNode } from '#/features/engine/types'
import type { Template } from '#/features/pipelines/types'

/** Template nodes wrap after this many per row, so a template fits the canvas at full size. */
const NODES_PER_ROW = 4
const COLUMN_STEP = 300
/** Leaves room for the preview each node shows once there is a sample image. */
const ROW_STEP = 280

type Step = [id: string, type: string, settings?: Record<string, unknown>]

function node([id, type, settings]: Step, column: number, row: number): PipelineNode {
  return {
    id,
    type,
    settings: settings ?? {},
    position: { x: column * COLUMN_STEP, y: row * ROW_STEP },
  }
}

function connect(source: string, target: string) {
  return { id: `${source}-out-${target}`, source, sourcePort: 'out', target }
}

/** Steps in a line, wrapping into rows. */
function line(steps: Step[]): Pipeline {
  return {
    nodes: steps.map((step, index) =>
      node(step, index % NODES_PER_ROW, Math.floor(index / NODES_PER_ROW)),
    ),
    connections: steps.slice(1).map(([id], index) => connect(steps[index][0], id)),
  }
}

/** Shared steps in a line, then one branch per row. */
function branches(shared: Step[], rows: Step[][]): Pipeline {
  const last = shared.at(-1)?.[0] as string
  return {
    nodes: [
      ...shared.map((step, index) => node(step, index, 0)),
      ...rows.flatMap((row, rowIndex) =>
        row.map((step, index) => node(step, shared.length + index, rowIndex)),
      ),
    ],
    connections: [
      ...shared.slice(1).map(([id], index) => connect(shared[index][0], id)),
      ...rows.flatMap((row) => [
        connect(last, row[0][0]),
        ...row.slice(1).map(([id], index) => connect(row[index][0], id)),
      ]),
    ],
  }
}

/** Every template. The picker shows those whose nodes all exist in the registry. */
export const TEMPLATES: Template[] = [
  {
    id: 'web-ready-photos',
    name: 'Web-ready photos',
    description:
      'Turns photos upright, fits them in 2048 pixels, keeps only copyright, saves WebP.',
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
    id: 'email-photos',
    name: 'Photos for email',
    description: 'Turns photos upright, fits them in 1600 pixels and keeps each JPEG under 300 KB.',
    pipeline: line([
      ['files', 'files'],
      ['rotate', 'rotate', { auto: true }],
      ['resize', 'resize', { mode: 'longestEdge', longestEdge: 1600 }],
      ['compress', 'compress-to-size', { targetKilobytes: 300, format: 'jpeg' }],
      ['output', 'output', { archiveName: 'email-photos' }],
    ]),
  },
  {
    id: 'remove-location',
    name: 'Remove location',
    description: 'Removes GPS and place names before sharing. Pixels and formats stay the same.',
    pipeline: line([
      ['files', 'files'],
      ['strip', 'strip-metadata', { mode: 'location' }],
      ['output', 'output'],
    ]),
  },
  {
    id: 'square-thumbnails',
    name: 'Square thumbnails',
    description: 'Crops a centred square, fits it in 512 pixels and saves WebP.',
    pipeline: line([
      ['files', 'files'],
      ['crop', 'crop', { aspect: '1:1' }],
      ['resize', 'resize', { mode: 'longestEdge', longestEdge: 512 }],
      ['convert', 'convert', { format: 'webp', webp: { quality: 75 } }],
      ['output', 'output', { archiveName: 'thumbnails' }],
    ]),
  },
  {
    id: 'webp-and-avif',
    name: 'WebP and AVIF',
    description:
      'Fits images in 2048 pixels and saves every image twice: once as WebP, once as AVIF.',
    pipeline: branches(
      [
        ['files', 'files'],
        ['rotate', 'rotate', { auto: true }],
        ['resize', 'resize', { mode: 'longestEdge', longestEdge: 2048 }],
      ],
      [
        [
          ['convert-webp', 'convert', { format: 'webp', webp: { quality: 80 } }],
          ['output-webp', 'output', { archiveName: 'webp' }],
        ],
        [
          ['convert-avif', 'convert', { format: 'avif', avif: { quality: 60 } }],
          ['output-avif', 'output', { archiveName: 'avif' }],
        ],
      ],
    ),
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

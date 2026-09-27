/** One line that tells what a node's settings do, shown on its card in the canvas. */
import type { Pipeline } from '#/features/engine/types'
import { FORMAT_NAMES } from '#/features/images/image-item'

type Settings = Record<string, unknown>

function formatName(format: unknown) {
  return FORMAT_NAMES[format as keyof typeof FORMAT_NAMES] ?? String(format)
}

const STRIP_SUMMARIES: Record<string, string> = {
  all: 'Removes all metadata',
  location: 'Removes only location',
  copyright: 'Keeps only copyright',
}

function resize(settings: Settings) {
  switch (settings.mode) {
    case 'longestEdge':
      return `Longest edge ${settings.longestEdge} px`
    case 'width':
      return `Width ${settings.width} px`
    case 'height':
      return `Height ${settings.height} px`
    case 'percent':
      return `${settings.percent}% of the original`
    default:
      return `${settings.width}×${settings.height} px, ${settings.fit}`
  }
}

function convert(settings: Settings) {
  const format = settings.format as string
  if (format === 'original') return 'Same format as the input'
  if (format === 'png' || format === 'qoi') return `${formatName(format)}, lossless`
  const options = (settings[format] ?? {}) as { quality?: number; lossless?: boolean }
  return options.lossless
    ? `${formatName(format)}, lossless`
    : `${formatName(format)}, quality ${options.quality}`
}

function rotate(settings: Settings) {
  const parts = [
    settings.auto ? 'Upright from the camera tag' : null,
    settings.rotate ? `Rotate ${settings.rotate}°` : null,
    settings.flipHorizontal ? 'flip horizontally' : null,
    settings.flipVertical ? 'flip vertically' : null,
  ].filter((part): part is string => part !== null)
  return parts.length > 0 ? parts.join(', ') : 'No change'
}

function crop(settings: Settings) {
  const aspect =
    settings.aspect === 'custom'
      ? `${settings.customWidth}:${settings.customHeight}`
      : String(settings.aspect)
  const position = String(settings.position).replace('-', ' ')
  return position === 'center' ? `${aspect} from the centre` : `${aspect} from the ${position}`
}

export function summariseNode(type: string, settings: Settings): string {
  switch (type) {
    case 'resize':
      return resize(settings)
    case 'convert':
      return convert(settings)
    case 'rotate':
      return rotate(settings)
    case 'crop':
      return crop(settings)
    case 'strip-metadata':
      return STRIP_SUMMARIES[settings.mode as string] ?? ''
    case 'compress-to-size':
      return settings.format === 'original'
        ? `Under ${settings.targetKilobytes} KB, same format`
        : `Under ${settings.targetKilobytes} KB as ${formatName(settings.format)}`
    case 'optimize-png':
      return `Effort ${settings.level} of 6`
    case 'rename':
      return String(settings.template)
    case 'output':
      return settings.destination === 'folder'
        ? 'Saves to a folder'
        : `ZIP named ${settings.archiveName}.zip`
    case 'filter': {
      const count = (settings.rules as unknown[]).length
      return `${count} rule${count === 1 ? '' : 's'}`
    }
    default:
      return ''
  }
}

/**
 * The node types of a pipeline in the order items reach them, without the Files node every
 * pipeline starts with. A type used on several branches is listed once with its count.
 */
export function pipelineSteps(pipeline: Pipeline) {
  const children = new Map<string, string[]>()
  for (const connection of pipeline.connections) {
    children.set(connection.source, [...(children.get(connection.source) ?? []), connection.target])
  }
  const targets = new Set(pipeline.connections.map((connection) => connection.target))
  const queue = pipeline.nodes.filter((node) => !targets.has(node.id)).map((node) => node.id)
  const seen = new Set<string>()
  const counts = new Map<string, number>()
  while (queue.length > 0) {
    const id = queue.shift() as string
    if (seen.has(id)) continue
    seen.add(id)
    const type = pipeline.nodes.find((node) => node.id === id)?.type
    if (type && type !== 'files') counts.set(type, (counts.get(type) ?? 0) + 1)
    queue.push(...(children.get(id) ?? []))
  }
  return [...counts].map(([type, count]) => ({ type, count }))
}

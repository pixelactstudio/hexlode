/** One line that tells what a node's settings do, shown on its card in the canvas. */
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

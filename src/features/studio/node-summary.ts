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

/** "bottom right", "centre". */
function placeName(position: unknown) {
  return position === 'center' ? 'centre' : String(position).replace('-', ' ')
}

/** "JPEG, PNG or JPEG XL". */
function listOr(words: string[]) {
  return words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} or ${words.at(-1)}`
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/** "+20", "−10", "+0.5". */
function signed(value: number) {
  return value > 0 ? `+${value}` : `−${Math.abs(value)}`
}

function adjust(settings: Settings) {
  const parts = (['brightness', 'contrast', 'saturation', 'exposure'] as const)
    .filter((key) => settings[key] !== 0)
    .map((key) => `${key} ${signed(Number(settings[key]))}`)
  if (parts.length === 0) return 'No change'
  const text = parts.join(', ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function border(settings: Settings) {
  const unit = settings.unit === 'pixels' ? ' px' : '%'
  const parts = [
    Number(settings.border) > 0 ? `${settings.border}${unit} border` : null,
    Number(settings.radius) > 0 ? `${settings.radius}${unit} corners` : null,
  ].filter((part): part is string => part !== null)
  return parts.length > 0 ? parts.join(', ') : 'No change'
}

const PAGE_SIZES: Record<string, string> = {
  a4: 'A4 pages',
  letter: 'Letter pages',
  image: 'Pages fit each image',
}

function batchTwo(type: string, settings: Settings): string | undefined {
  switch (type) {
    case 'deduplicate':
      return `${settings.mode === 'exact' ? 'Exact' : 'Near'} duplicates, keeps the ${settings.keep}`
    case 'auto-trim':
      return Number(settings.padding) > 0
        ? `Tolerance ${settings.tolerance}%, keeps ${settings.padding} px`
        : `Tolerance ${settings.tolerance}%`
    case 'pad': {
      const aspect =
        settings.aspect === 'custom'
          ? `${settings.customWidth}:${settings.customHeight}`
          : String(settings.aspect)
      return settings.fill === 'blur'
        ? `${aspect}, blurred fill`
        : `${aspect}, filled with ${settings.colour}`
    }
    case 'pixel-art':
      return `${settings.scale}x, ${settings.method === 'smooth' ? 'smooth diagonals' : 'hard pixels'}`
    case 'split':
      return `${settings.columns} × ${settings.rows} grid`
    case 'adjust':
      return adjust(settings)
    case 'filters': {
      const name =
        String(settings.filter).charAt(0).toUpperCase() + String(settings.filter).slice(1)
      return settings.strength === 100 ? name : `${name} at ${settings.strength}%`
    }
    case 'sharpen-blur': {
      const effect =
        settings.effect === 'blur'
          ? `Blur ${settings.radius} px`
          : `Sharpen ${settings.amount}% at ${settings.radius} px`
      return settings.region === 'area' ? `${effect}, in an area` : effect
    }
    case 'background':
      return `Fills transparency with ${settings.colour}`
    case 'remove-background':
      return 'Cuts the subject out onto transparency'
    case 'text-watermark':
      return `“${String(settings.text).trim()}”, ${settings.tile ? 'tiled' : placeName(settings.position)}`
    case 'image-watermark': {
      const logo = settings.logo as { name: string } | null
      return logo ? `${logo.name}, ${placeName(settings.position)}` : 'No logo chosen'
    }
    case 'border':
      return border(settings)
    default:
      return undefined
  }
}

function batchThree(type: string, settings: Settings): string | undefined {
  switch (type) {
    case 'set-copyright': {
      const parts = [String(settings.artist).trim(), String(settings.copyright).trim()].filter(
        Boolean,
      )
      return parts.length > 0 ? parts.join(', ') : 'Nothing set'
    }
    case 'best-format': {
      const names = (settings.formats as string[]).map(formatName)
      const options = settings.keepOriginal ? [...names, 'the original'] : names
      return `Smallest of ${options.length === 2 ? options.join(' and ') : listOr(options)}`
    }
    case 'responsive-set': {
      const count = plural((settings.widths as number[]).length, 'width')
      return settings.format === 'original'
        ? `${count}, same format`
        : `${count} as ${formatName(settings.format)}`
    }
    case 'favicon': {
      const fit = settings.fit === 'cover' ? 'Fills each icon' : 'Fits each icon'
      return Number(settings.padding) > 0 ? `${fit}, ${settings.padding}% padding` : fit
    }
    case 'placeholder':
      return settings.method === 'blurhash'
        ? `BlurHash, ${settings.componentsX} × ${settings.componentsY}`
        : `Data URI, ${settings.size} px`
    case 'palette':
      return `${plural(Number(settings.count), 'colour')} as ${settings.format === 'css' ? 'CSS variables' : 'JSON'}`
    case 'contact-sheet':
      return `${plural(Number(settings.columns), 'column')} of ${settings.cell} px, ${formatName(settings.format)}`
    case 'images-to-pdf':
      return `${PAGE_SIZES[String(settings.pageSize)]}, ${String(settings.name).trim() || 'images'}.pdf`
    default:
      return undefined
  }
}

export function summariseNode(type: string, settings: Settings): string {
  const later = batchTwo(type, settings) ?? batchThree(type, settings)
  if (later !== undefined) return later
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

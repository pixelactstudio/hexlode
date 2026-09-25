/**
 * The four quick tools. Each is a fixed pipeline on the same engine as the Studio
 * (ADR 0001): Files, one processing node, Output.
 */
import type { QUICK_TOOLS } from '#/features/analytics/events'
import type { Pipeline } from '#/features/engine/types'

export type QuickTool = (typeof QUICK_TOOLS)[number]

export type TargetFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'jxl' | 'qoi'

export interface ConvertToolSettings {
  format: TargetFormat
  quality: number
  lossless: boolean
}

export interface CompressToolSettings {
  mode: 'quality' | 'target'
  quality: number
  targetKilobytes: number
  format: 'original' | 'jpeg' | 'webp' | 'avif' | 'jxl'
}

export interface ResizeToolSettings {
  mode: 'longestEdge' | 'width' | 'height' | 'percent' | 'box'
  longestEdge: number
  width: number
  height: number
  percent: number
  fit: 'fit' | 'fill' | 'exact'
  method: 'lanczos3' | 'mitchell' | 'catrom' | 'triangle'
  allowUpscale: boolean
}

export interface StripToolSettings {
  mode: 'all' | 'location' | 'copyright'
  keepColourProfile: boolean
}

export interface QuickToolSettings {
  convert: ConvertToolSettings
  compress: CompressToolSettings
  resize: ResizeToolSettings
  'strip-metadata': StripToolSettings
}

export const OUTPUT_NODE_ID = 'output'

export const QUICK_TOOL_DEFINITIONS: {
  [T in QuickTool]: {
    title: string
    description: string
    path: string
    defaults: QuickToolSettings[T]
  }
} = {
  convert: {
    title: 'Convert',
    description: 'Change format: JPEG, PNG, WebP, AVIF, JPEG XL or QOI.',
    path: '/convert',
    defaults: { format: 'webp', quality: 82, lossless: false },
  },
  compress: {
    title: 'Compress',
    description: 'Reduce file size by quality setting or by target size.',
    path: '/compress',
    defaults: { mode: 'quality', quality: 75, targetKilobytes: 200, format: 'original' },
  },
  resize: {
    title: 'Resize',
    description: 'Change dimensions by width, height, percent or longest edge.',
    path: '/resize',
    defaults: {
      mode: 'longestEdge',
      longestEdge: 1920,
      width: 1920,
      height: 1080,
      percent: 50,
      fit: 'fit',
      method: 'lanczos3',
      allowUpscale: false,
    },
  },
  'strip-metadata': {
    title: 'Strip metadata',
    description: 'Remove all metadata, only location data, or everything except copyright.',
    path: '/strip-metadata',
    defaults: { mode: 'all', keepColourProfile: true },
  },
}

export const LOSSLESS_CAPABLE: TargetFormat[] = ['webp', 'avif', 'jxl']
export const QUALITY_FORMATS: TargetFormat[] = ['jpeg', 'webp', 'avif', 'jxl']

function convertSettings(settings: ConvertToolSettings) {
  const { format, quality, lossless } = settings
  if (format === 'png' || format === 'qoi') return { format }
  if (format === 'jpeg') return { format, jpeg: { quality } }
  return { format, [format]: { quality, lossless } }
}

function processingNode<T extends QuickTool>(tool: T, settings: QuickToolSettings[T]) {
  switch (tool) {
    case 'convert':
      return { type: 'convert', settings: convertSettings(settings as ConvertToolSettings) }
    case 'compress': {
      const compress = settings as CompressToolSettings
      if (compress.mode === 'target') {
        return {
          type: 'compress-to-size',
          settings: { targetKilobytes: compress.targetKilobytes, format: compress.format },
        }
      }
      const quality = { quality: compress.quality }
      return {
        type: 'convert',
        settings: {
          format: 'original',
          keepSmaller: true,
          jpeg: quality,
          webp: quality,
          avif: quality,
          jxl: quality,
          png: { optimisationLevel: 3 },
        },
      }
    }
    case 'resize':
      return { type: 'resize', settings: { ...(settings as ResizeToolSettings) } }
    default:
      return { type: 'strip-metadata', settings: { ...(settings as StripToolSettings) } }
  }
}

export function quickToolPipeline<T extends QuickTool>(
  tool: T,
  settings: QuickToolSettings[T],
): Pipeline {
  const step = processingNode(tool, settings)
  return {
    nodes: [
      { id: 'files', type: 'files', settings: {}, position: { x: 0, y: 0 } },
      { id: 'step', type: step.type, settings: step.settings, position: { x: 280, y: 0 } },
      { id: OUTPUT_NODE_ID, type: 'output', settings: {}, position: { x: 560, y: 0 } },
    ],
    connections: [
      { id: 'files-step', source: 'files', sourcePort: 'out', target: 'step' },
      { id: 'step-output', source: 'step', sourcePort: 'out', target: OUTPUT_NODE_ID },
    ],
  }
}

/**
 * The quick tools. Each is a fixed pipeline on the same engine as the Studio (ADR 0001): Files,
 * one processing node, Output.
 */

import type { Pipeline } from '#/features/engine/types'
import type { ASPECT_PRESETS, CROP_POSITIONS } from '#/features/nodes/definitions/crop'
import type { QUICK_TOOLS } from '#/features/usage/events'

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

export interface CropToolSettings {
  aspect: (typeof ASPECT_PRESETS)[number] | 'custom'
  customWidth: number
  customHeight: number
  position: (typeof CROP_POSITIONS)[number]
}

export interface RotateToolSettings {
  auto: boolean
  rotate: 0 | 90 | 180 | 270
  flipHorizontal: boolean
  flipVertical: boolean
}

export interface StripToolSettings {
  mode: 'all' | 'location' | 'copyright'
  keepColourProfile: boolean
}

export interface QuickToolSettings {
  convert: ConvertToolSettings
  compress: CompressToolSettings
  resize: ResizeToolSettings
  crop: CropToolSettings
  rotate: RotateToolSettings
  'strip-metadata': StripToolSettings
}

export const OUTPUT_NODE_ID = 'output'

export const QUICK_TOOL_DEFINITIONS: {
  [T in QuickTool]: {
    title: string
    /** One sentence for the tool page. */
    description: string
    /** A few words for menus and the home page. */
    summary: string
    path: string
    defaults: QuickToolSettings[T]
  }
} = {
  convert: {
    title: 'Convert',
    description: 'Change format: JPEG, PNG, WebP, AVIF, JPEG XL or QOI.',
    summary: 'Switch between JPEG, PNG, WebP, AVIF, JPEG XL and QOI.',
    path: '/convert',
    defaults: { format: 'webp', quality: 82, lossless: false },
  },
  compress: {
    title: 'Compress',
    description: 'Reduce file size by quality setting or by target size.',
    summary: 'Make files smaller by quality or to a size you choose.',
    path: '/compress',
    defaults: { mode: 'quality', quality: 75, targetKilobytes: 200, format: 'original' },
  },
  resize: {
    title: 'Resize',
    description: 'Change dimensions by width, height, percent or longest edge.',
    summary: 'Scale by width, height, percentage or longest edge.',
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
  crop: {
    title: 'Crop',
    description: 'Cut to an aspect ratio such as 1:1, 4:5 or 16:9, from the centre or an edge.',
    summary: 'Cut to 1:1, 4:5, 16:9 and other shapes.',
    path: '/crop',
    defaults: { aspect: '1:1', customWidth: 1, customHeight: 1, position: 'center' },
  },
  rotate: {
    title: 'Rotate',
    description: 'Turn photos upright, rotate by quarter turns or flip them.',
    summary: 'Turn photos upright, rotate or flip them.',
    path: '/rotate',
    defaults: { auto: true, rotate: 0, flipHorizontal: false, flipVertical: false },
  },
  'strip-metadata': {
    title: 'Strip metadata',
    description: 'Remove all metadata, only location data, or everything except copyright.',
    summary: 'Remove location, camera details and other hidden data.',
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
    case 'crop':
      return { type: 'crop', settings: { ...(settings as CropToolSettings) } }
    case 'rotate':
      return { type: 'rotate', settings: { ...(settings as RotateToolSettings) } }
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

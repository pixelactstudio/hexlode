import type { WorkflowDefinition, WorkflowKind } from '#/features/canvas/workflow/types'
import { DEFAULT_MAX_DIMENSION, DEFAULT_WEBP_QUALITY } from '#/features/processing/constants'

export const WORKFLOW_KINDS = [
  'files',
  'inspect',
  'resize',
  'webp',
  'compare',
  'download',
] as const satisfies readonly WorkflowKind[]

export const WORKFLOW_DEFINITIONS: Record<WorkflowKind, WorkflowDefinition> = {
  files: {
    label: 'Files',
    description: 'Choose one local JPEG or PNG.',
    summary: 'JPEG or PNG',
  },
  inspect: {
    label: 'Inspect',
    description: 'Verify the signature, dimensions, and memory estimate.',
    summary: 'Safety checks',
  },
  resize: {
    label: 'Resize',
    description: 'Fit the long edge without upscaling.',
    summary: `Max ${DEFAULT_MAX_DIMENSION} px`,
  },
  webp: {
    label: 'WebP',
    description: 'Encode a local WebP output.',
    summary: `Quality ${DEFAULT_WEBP_QUALITY}%`,
  },
  compare: {
    label: 'Compare',
    description: 'Review dimensions and file-size savings.',
    summary: 'Before / after',
  },
  download: {
    label: 'Download',
    description: 'Save the output to this device.',
    summary: 'WebP file',
  },
}

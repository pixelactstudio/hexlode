import {
  Columns2,
  Crop,
  Eraser,
  Images,
  Minimize2,
  PackageCheck,
  Repeat2,
  RotateCw,
  Scaling,
  ScanSearch,
  Sparkles,
  Split,
  TextCursorInput,
} from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

import type { Tone } from '#/features/app-shell/icon-tile'
import type { NodeCategory } from '#/features/engine/types'

export const NODE_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  files: Images,
  filter: Split,
  inspect: ScanSearch,
  resize: Scaling,
  crop: Crop,
  rotate: RotateCw,
  'strip-metadata': Eraser,
  convert: Repeat2,
  'compress-to-size': Minimize2,
  'optimize-png': Sparkles,
  rename: TextCursorInput,
  output: PackageCheck,
  compare: Columns2,
}

/** Node library categories, in the order of the node catalogue. */
export const CATEGORIES: { id: NodeCategory; label: string; short: string; tone: Tone }[] = [
  { id: 'input', label: 'Input and routing', short: 'Input', tone: 'blue' },
  { id: 'size', label: 'Size and shape', short: 'Shape', tone: 'purple' },
  { id: 'colour', label: 'Colour and look', short: 'Colour', tone: 'pink' },
  { id: 'overlay', label: 'Overlays', short: 'Overlays', tone: 'orange' },
  { id: 'metadata', label: 'Metadata', short: 'Metadata', tone: 'teal' },
  { id: 'output', label: 'Output and encoding', short: 'Output', tone: 'green' },
]

export function toneOf(category: NodeCategory | undefined): Tone {
  return CATEGORIES.find((entry) => entry.id === category)?.tone ?? 'gray'
}

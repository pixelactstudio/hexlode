import { Crop, Eraser, Minimize2, Repeat2, RotateCw, Scaling } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

import type { QuickTool } from '#/features/quick-tools/tools'

export const QUICK_TOOL_ICONS: Record<QuickTool, ComponentType<SVGProps<SVGSVGElement>>> = {
  convert: Repeat2,
  compress: Minimize2,
  resize: Scaling,
  crop: Crop,
  rotate: RotateCw,
  'strip-metadata': Eraser,
}

/** Quick tools grouped the way the navigation and the home page list them. */
export const QUICK_TOOL_GROUPS: { label: string; tools: QuickTool[] }[] = [
  { label: 'Format and size', tools: ['convert', 'compress'] },
  { label: 'Shape', tools: ['resize', 'crop', 'rotate'] },
  { label: 'Metadata', tools: ['strip-metadata'] },
]

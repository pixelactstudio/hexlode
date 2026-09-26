import { Eraser, Minimize2, Repeat2, Scaling } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

import type { Tone } from '#/features/app-shell/icon-tile'
import type { QuickTool } from '#/features/quick-tools/tools'

export const QUICK_TOOL_UI: Record<
  QuickTool,
  { icon: ComponentType<SVGProps<SVGSVGElement>>; tone: Tone; settingsHint: string }
> = {
  convert: {
    icon: Repeat2,
    tone: 'blue',
    settingsHint: 'Pick the format the images should be saved in.',
  },
  compress: {
    icon: Minimize2,
    tone: 'green',
    settingsHint: 'Choose a quality, or a file size every image should fit under.',
  },
  resize: {
    icon: Scaling,
    tone: 'purple',
    settingsHint: 'Choose which side sets the size. Proportions are kept unless you say so.',
  },
  'strip-metadata': {
    icon: Eraser,
    tone: 'teal',
    settingsHint: 'Choose what to remove. Pixels are not touched.',
  },
}

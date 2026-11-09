import { AppWindow, FileText, ImageDown, ImagePlus, Proportions, Stamp } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

import type { BuiltInToolSlug } from '#/features/built-in-tools/types'

export const BUILT_IN_TOOL_ICONS: Record<
  BuiltInToolSlug,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  'webp-to-jpg': ImageDown,
  'jpg-to-pdf': FileText,
  'instagram-no-crop': Proportions,
  'favicon-generator': AppWindow,
  'watermark-photos': Stamp,
  'add-logo-to-photos': ImagePlus,
}

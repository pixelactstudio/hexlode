import { createFileRoute } from '@tanstack/react-router'

import { QuickToolPage } from '#/features/quick-tools/quick-tool-page'
import { QUICK_TOOL_DEFINITIONS } from '#/features/quick-tools/tools'

export const Route = createFileRoute('/crop')({
  head: () => ({ meta: [{ title: `${QUICK_TOOL_DEFINITIONS.crop.title} images — Hexlode` }] }),
  component: () => <QuickToolPage tool="crop" />,
})

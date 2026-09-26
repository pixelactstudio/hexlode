import { createFileRoute } from '@tanstack/react-router'

import { QuickToolPage } from '#/features/quick-tools/quick-tool-page'
import { QUICK_TOOL_DEFINITIONS } from '#/features/quick-tools/tools'

export const Route = createFileRoute('/compress')({
  head: () => ({
    meta: [{ title: `${QUICK_TOOL_DEFINITIONS.compress.title} images — Hexlode` }],
  }),
  component: () => <QuickToolPage tool="compress" />,
})

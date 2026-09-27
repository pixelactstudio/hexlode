import { createFileRoute } from '@tanstack/react-router'

import { QuickToolPage } from '#/features/quick-tools/quick-tool-page'
import { QUICK_TOOL_DEFINITIONS } from '#/features/quick-tools/tools'

export const Route = createFileRoute('/strip-metadata')({
  head: () => ({
    meta: [{ title: `${QUICK_TOOL_DEFINITIONS['strip-metadata'].title} images — Hexlode` }],
  }),
  component: () => <QuickToolPage tool="strip-metadata" />,
})

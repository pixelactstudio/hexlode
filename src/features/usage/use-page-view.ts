import { useEffect } from 'react'
import type { EventProperties } from '#/features/usage/events'
import { track } from '#/features/usage/usage'

export function usePageView(properties: EventProperties<'page_viewed'>) {
  const { page, tool, builtInTool } = properties
  useEffect(() => {
    track('page_viewed', {
      page,
      ...(tool ? { tool } : {}),
      ...(builtInTool ? { builtInTool } : {}),
    })
  }, [page, tool, builtInTool])
}

import { useEffect } from 'react'

import { track } from '#/features/analytics/analytics'
import type { EventProperties } from '#/features/analytics/events'

export function usePageView(properties: EventProperties<'page_viewed'>) {
  const { page, tool } = properties
  useEffect(() => {
    track('page_viewed', tool ? { page, tool } : { page })
  }, [page, tool])
}

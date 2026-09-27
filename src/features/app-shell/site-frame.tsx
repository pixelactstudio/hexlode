import { useRouterState } from '@tanstack/react-router'
import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

import { pageOf } from '#/features/app-shell/pages'
import { SiteFooter } from '#/features/app-shell/site-footer'
import { SiteHeader } from '#/features/app-shell/site-header'

/**
 * The frame around every page: the top bar, the page and the footer. It lives in the root route,
 * so the top bar stays mounted while pages change and can animate between shapes. The Studio fills
 * the window and has no footer. Animations follow the system's reduced motion setting.
 */
export function SiteFrame({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const page = pageOf(pathname)
  const fill = page === 'studio'
  return (
    <MotionConfig reducedMotion="user">
      <div className={`flex flex-col overflow-x-clip bg-surface ${fill ? 'h-dvh' : 'min-h-dvh'}`}>
        <SiteHeader page={page} />
        <main className={`flex flex-1 flex-col ${fill ? 'min-h-0' : ''}`}>{children}</main>
        {fill ? null : <SiteFooter />}
      </div>
    </MotionConfig>
  )
}

import { AppShell } from '@astryxdesign/core/AppShell'
import { TopNav, TopNavHeading, TopNavItem } from '@astryxdesign/core/TopNav'
import type { ReactNode } from 'react'

import { HexlodeMark } from '#/features/app-shell/hexlode-mark'
import { QUICK_TOOL_DEFINITIONS } from '#/features/quick-tools/tools'

export type FramePage =
  | 'convert'
  | 'compress'
  | 'resize'
  | 'strip-metadata'
  | 'studio'
  | 'privacy'
  | 'tool'

const NAV_ITEMS: { page: FramePage; label: string; href: string }[] = [
  ...Object.entries(QUICK_TOOL_DEFINITIONS).map(([page, tool]) => ({
    page: page as FramePage,
    label: tool.title,
    href: tool.path,
  })),
  { page: 'studio', label: 'Studio', href: '/studio' },
]

export function AppFrame({
  current,
  children,
  height = 'auto',
  contentPadding = 6,
  endContent,
}: {
  current: FramePage
  children: ReactNode
  height?: 'auto' | 'fill'
  contentPadding?: 0 | 4 | 6
  endContent?: ReactNode
}) {
  return (
    <AppShell
      height={height}
      variant="section"
      contentPadding={contentPadding}
      topNav={
        <TopNav
          label="Main navigation"
          heading={<TopNavHeading heading="Hexlode" headingHref="/" logo={<HexlodeMark />} />}
          startContent={NAV_ITEMS.map((item) => (
            <TopNavItem
              key={item.page}
              label={item.label}
              href={item.href}
              isSelected={item.page === current}
            />
          ))}
          endContent={endContent}
        />
      }
    >
      {children}
    </AppShell>
  )
}

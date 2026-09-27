import { Icon } from '@astryxdesign/core/Icon'
import { HStack } from '@astryxdesign/core/Stack'
import { TopNav, TopNavHeading, TopNavItem } from '@astryxdesign/core/TopNav'
import { useEffect, useState } from 'react'

import { DOCK_AFTER, REPOSITORY_URL } from '#/features/app-shell/constants'
import { GitHubMark } from '#/features/app-shell/github-mark'
import { HexlodeMark } from '#/features/app-shell/hexlode-mark'
import type { FramePage } from '#/features/app-shell/pages'
import { MobileMenu, ToolsMenu } from '#/features/app-shell/tools-menu'
import { ColourModeMenu } from '#/features/theme/colour-mode-menu'

/** True once the window has scrolled further than `offset`, checked at most once a frame. */
function useScrolledPast(offset: number, isEnabled: boolean) {
  const [past, setPast] = useState(false)
  useEffect(() => {
    if (!isEnabled) {
      setPast(false)
      return
    }
    let frame = 0
    const update = () => {
      frame = 0
      setPast(window.scrollY > offset)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [offset, isEnabled])
  return past
}

/*
 * The bar's three shapes. It lines its ends up with the 1200px page column, spans the window on
 * the Studio, and folds into a floating dock once the page scrolls. Moving between them animates
 * the width, padding, corners and border.
 */
const SHAPES = {
  column:
    'max-w-full rounded-none border-transparent border-b-border px-[max(8px,calc((100%_-_1216px)/2))]',
  window: 'max-w-full rounded-none border-transparent border-b-border px-1',
  dock: 'max-w-[min(960px,calc(100%_-_24px))] translate-y-3 rounded-xl border-border px-1 shadow-lg',
}

/**
 * The top bar: the name, the Tools menu and the Studio, then GitHub and the colour mode. It stays
 * mounted while pages change, so going to the Studio widens it smoothly. The bar is opaque, so the
 * page never shows through it.
 */
export function SiteHeader({ page }: { page: FramePage }) {
  const isStudio = page === 'studio'
  const docked = useScrolledPast(DOCK_AFTER, !isStudio)
  const shape = docked ? SHAPES.dock : isStudio ? SHAPES.window : SHAPES.column
  return (
    <header className="sticky top-0 z-40 flex justify-center">
      <div
        className={`w-full border bg-surface transition-[max-width,padding,border-radius,border-color,box-shadow,translate] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${shape}`}
      >
        <TopNav
          label="Main navigation"
          heading={<TopNavHeading heading="Hexlode" headingHref="/" logo={<HexlodeMark />} />}
          startContent={
            <span className="hidden items-center gap-1 md:flex">
              <ToolsMenu page={page} />
              <TopNavItem label="Studio" href="/studio" isSelected={isStudio} />
            </span>
          }
          endContent={
            <HStack gap={1} vAlign="center">
              <TopNavItem
                label="Hexlode on GitHub"
                href={REPOSITORY_URL}
                icon={<Icon icon={GitHubMark} size="sm" />}
                isIconOnly
              />
              <ColourModeMenu />
              <span className="md:hidden">
                <MobileMenu page={page} />
              </span>
            </HStack>
          }
        />
      </div>
    </header>
  )
}

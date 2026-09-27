import { createFileRoute } from '@tanstack/react-router'

import { ClosingCall, DeviceSection } from '#/features/home/device-section'
import { Formats } from '#/features/home/formats'
import { Hero } from '#/features/home/hero'
import { Rails } from '#/features/home/section'
import { StudioBento } from '#/features/home/studio-bento'
import { ToolGrid } from '#/features/home/tool-grid'
import { usePageView } from '#/features/usage/use-page-view'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  usePageView({ page: 'home' })
  return (
    <Rails>
      <Hero />
      <Formats />
      <StudioBento />
      <ToolGrid />
      <DeviceSection />
      <ClosingCall />
    </Rails>
  )
}

import { createFileRoute } from '@tanstack/react-router'

import { CanvasWorkbench } from '#/features/canvas/canvas-workbench'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return <CanvasWorkbench />
}

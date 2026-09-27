import { QUICK_TOOL_DEFINITIONS, type QuickTool } from '#/features/quick-tools/tools'
import { QUICK_TOOLS } from '#/features/usage/events'

export type FramePage = QuickTool | 'studio' | 'privacy' | 'tool' | 'home' | 'other'

/** Which page a path shows, for the top bar's selected item and the frame's shape. */
export function pageOf(pathname: string): FramePage {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return 'home'
  if (path === '/studio') return 'studio'
  if (path === '/privacy') return 'privacy'
  if (path.startsWith('/tools/')) return 'tool'
  return QUICK_TOOLS.find((tool) => QUICK_TOOL_DEFINITIONS[tool].path === path) ?? 'other'
}

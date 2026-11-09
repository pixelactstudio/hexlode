/**
 * The pages the service worker downloads when it installs, so each opens offline even before it
 * is first visited. Other pages, such as saved pipeline tools, open offline from the app shell.
 */
import { BUILT_IN_TOOLS } from '#/features/built-in-tools/tools'
import { OPEN_PATH } from '#/features/handover/constants'
import { APP_SHELL_PATH } from '#/features/offline/constants'
import { QUICK_TOOL_DEFINITIONS } from '#/features/quick-tools/tools'

export const OFFLINE_PAGES = [
  '/',
  ...Object.values(QUICK_TOOL_DEFINITIONS).map((tool) => tool.path),
  ...BUILT_IN_TOOLS.map((tool) => `/tools/${tool.slug}`),
  '/studio',
  '/privacy',
  OPEN_PATH,
  APP_SHELL_PATH,
]

import { Button } from '@astryxdesign/core/Button'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Popover } from '@astryxdesign/core/Popover'
import { Text } from '@astryxdesign/core/Text'
import { ArrowRight, ChevronDown, Menu, Workflow } from 'lucide-react'
import { useState } from 'react'

import { IconTile } from '#/features/app-shell/icon-tile'
import type { FramePage } from '#/features/app-shell/pages'
import { QUICK_TOOL_GROUPS, QUICK_TOOL_ICONS } from '#/features/quick-tools/tool-ui'
import { QUICK_TOOL_DEFINITIONS, type QuickTool } from '#/features/quick-tools/tools'
import { RouterLink } from '#/lib/router-link'

const TOOLS = QUICK_TOOL_GROUPS.flatMap((group) => group.tools)

const ROW =
  'flex items-start gap-3 rounded-md p-2.5 no-underline outline-accent transition-colors hover:bg-overlay-hover focus-visible:outline-2 aria-[current=page]:bg-overlay-hover'

function ToolLink({
  tool,
  page,
  onNavigate,
}: {
  tool: QuickTool
  page: FramePage
  onNavigate: () => void
}) {
  const definition = QUICK_TOOL_DEFINITIONS[tool]
  return (
    <RouterLink
      href={definition.path}
      className={ROW}
      aria-current={page === tool ? 'page' : undefined}
      onClick={onNavigate}
    >
      <IconTile icon={QUICK_TOOL_ICONS[tool]} size="sm" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <Text type="label" weight="semibold">
          {definition.title}
        </Text>
        <Text type="supporting">{definition.summary}</Text>
      </span>
    </RouterLink>
  )
}

function StudioLink({ page, onNavigate }: { page: FramePage; onNavigate: () => void }) {
  return (
    <RouterLink
      href="/studio"
      className={`${ROW} items-center`}
      aria-current={page === 'studio' ? 'page' : undefined}
      onClick={onNavigate}
    >
      <IconTile icon={Workflow} tone="pink" size="sm" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Text type="label" weight="semibold">
          Studio
        </Text>
        <Text type="supporting">Chain several tools into one pipeline.</Text>
      </span>
      <Icon icon={ArrowRight} size="sm" color="secondary" />
    </RouterLink>
  )
}

/**
 * The Tools button of the top bar. It opens on click, not on hover, so a click never flashes it
 * shut; clicking elsewhere, pressing Escape or following a link closes it.
 */
export function ToolsMenu({ page }: { page: FramePage }) {
  const [isOpen, setOpen] = useState(false)
  const close = () => setOpen(false)
  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={setOpen}
      label="Tools"
      placement="below"
      alignment="start"
      width={600}
      hasAutoFocus={false}
      content={
        <span className="flex flex-col gap-1 p-1">
          <span className="grid grid-cols-2 gap-1">
            {TOOLS.map((tool) => (
              <ToolLink key={tool} tool={tool} page={page} onNavigate={close} />
            ))}
          </span>
          <span className="mx-2.5 my-1 block h-px bg-border" />
          <StudioLink page={page} onNavigate={close} />
        </span>
      }
    >
      <Button
        label="Tools"
        variant="ghost"
        size="sm"
        endContent={
          <span className={`inline-flex transition-transform ${isOpen ? 'rotate-180' : ''}`}>
            <Icon icon={ChevronDown} size="xsm" color="secondary" />
          </span>
        }
      />
    </Popover>
  )
}

/** On phones the top bar folds its links into this menu. */
export function MobileMenu({ page }: { page: FramePage }) {
  const [isOpen, setOpen] = useState(false)
  const close = () => setOpen(false)
  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={setOpen}
      label="Menu"
      placement="below"
      alignment="end"
      width={320}
      hasAutoFocus={false}
      content={
        <span className="flex flex-col gap-1 p-1">
          <StudioLink page={page} onNavigate={close} />
          <span className="mx-2.5 my-1 block h-px bg-border" />
          {TOOLS.map((tool) => (
            <ToolLink key={tool} tool={tool} page={page} onNavigate={close} />
          ))}
        </span>
      }
    >
      <IconButton
        label={isOpen ? 'Close the menu' : 'Open the menu'}
        icon={<Icon icon={Menu} size="sm" />}
        variant="ghost"
        size="sm"
      />
    </Popover>
  )
}

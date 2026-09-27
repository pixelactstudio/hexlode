import {
  DropdownMenu,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@astryxdesign/core/DropdownMenu'
import { HoverCard } from '@astryxdesign/core/HoverCard'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Item } from '@astryxdesign/core/Item'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Token } from '@astryxdesign/core/Token'
import { Info, ListFilter, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react'
import { useState } from 'react'

import { IconTile } from '#/features/app-shell/icon-tile'
import { describeTypes } from '#/features/engine/item-types'
import type { AnyNodeDefinition, NodeCategory, NodeRegistry } from '#/features/engine/types'
import { NODE_DRAG_TYPE } from '#/features/studio/constants'
import { CATEGORIES, NODE_ICONS, toneOf } from '#/features/studio/node-ui'

const ALL = 'all'

function accepts(definition: AnyNodeDefinition) {
  try {
    return describeTypes(definition.accepts(definition.defaults as never))
  } catch {
    return null
  }
}

/** What a node does and what it takes, shown when the pointer rests on it. */
function NodeDetails({ definition }: { definition: AnyNodeDefinition }) {
  const takes = definition.hasInput ? accepts(definition) : null
  return (
    <VStack gap={1} maxWidth={260}>
      <Text type="label" weight="semibold">
        {definition.label}
      </Text>
      <Text type="supporting">{definition.description}</Text>
      {takes ? <Text type="supporting">{`Takes ${takes}.`}</Text> : null}
    </VStack>
  )
}

/** Lets a node be dragged onto the canvas; the control inside adds it on click. */
function Draggable({ type, children }: { type: string; children: React.ReactNode }) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: dragging is a pointer shortcut; the button inside is the accessible way to add the node.
    <span
      draggable
      className="block cursor-grab rounded-md"
      onDragStart={(event) => {
        event.dataTransfer.setData(NODE_DRAG_TYPE, type)
        event.dataTransfer.effectAllowed = 'copy'
      }}
    >
      {children}
    </span>
  )
}

/** The narrow rail the library folds into: one icon per node, with its name on hover. */
function LibraryRail({
  nodes,
  onAdd,
  onExpand,
}: {
  nodes: AnyNodeDefinition[]
  onAdd: (type: string, method: 'click' | 'search') => void
  onExpand: () => void
}) {
  return (
    <VStack gap={1} hAlign="center">
      <IconButton
        label="Show the node library"
        tooltip="Show nodes"
        icon={<PanelLeftOpen size={16} />}
        variant="ghost"
        size="sm"
        onClick={onExpand}
      />
      <span className="my-1 block h-px w-6 bg-border" />
      {nodes.map((node) => {
        const icon = NODE_ICONS[node.type]
        return (
          <Draggable key={node.type} type={node.type}>
            <IconButton
              label={`Add ${node.label}`}
              tooltip={node.label}
              icon={icon ? <IconTile icon={icon} tone={toneOf(node.category)} size="sm" /> : null}
              variant="ghost"
              onClick={() => onAdd(node.type, 'click')}
            />
          </Draggable>
        )
      })}
    </VStack>
  )
}

/**
 * Every node type by category. Search by name or description, narrow to one category with the
 * filter menu, then click a node to add it or drag it onto the canvas. The library folds into a
 * rail of icons to give the canvas more room.
 */
export function NodeLibrary({
  registry,
  onAdd,
  hasFiles,
  isCollapsed,
  onCollapsedChange,
}: {
  registry: NodeRegistry
  onAdd: (type: string, method: 'click' | 'search') => void
  hasFiles: boolean
  isCollapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<NodeCategory | typeof ALL>(ALL)
  const search = query.trim().toLocaleLowerCase()
  const all = registry.list().filter((node) => !(node.type === 'files' && hasFiles))
  const used = CATEGORIES.filter((entry) => all.some((node) => node.category === entry.id))
  const chosen = used.find((entry) => entry.id === category)
  const available = all
    .filter((node) => category === ALL || node.category === category)
    .filter(
      (node) =>
        !search ||
        node.label.toLocaleLowerCase().includes(search) ||
        node.description.toLocaleLowerCase().includes(search),
    )

  if (isCollapsed) {
    return <LibraryRail nodes={all} onAdd={onAdd} onExpand={() => onCollapsedChange(false)} />
  }

  return (
    <VStack gap={3}>
      <HStack gap={1} vAlign="center" hAlign="between">
        <Text type="label" weight="semibold">
          Nodes
        </Text>
        <IconButton
          label="Hide the node library"
          tooltip="Hide nodes"
          icon={<PanelLeftClose size={16} />}
          variant="ghost"
          size="sm"
          onClick={() => onCollapsedChange(true)}
        />
      </HStack>
      <HStack gap={1} vAlign="center">
        <span className="min-w-0 flex-1">
          <TextInput
            label="Find a node"
            isLabelHidden
            placeholder="Find a node"
            size="sm"
            startIcon={Search}
            value={query}
            hasClear
            onChange={setQuery}
          />
        </span>
        <DropdownMenu
          button={{
            label: chosen ? `Filter: ${chosen.label}` : 'Filter by category',
            icon: <Icon icon={ListFilter} size="sm" />,
            isIconOnly: true,
            variant: chosen ? 'secondary' : 'ghost',
            size: 'sm',
            tooltip: 'Filter',
          }}
          hasChevron={false}
          menuWidth={200}
          placement="below"
        >
          <DropdownMenuRadioGroup
            aria-label="Category"
            value={category}
            onChange={(value) => setCategory(value as NodeCategory | typeof ALL)}
          >
            <DropdownMenuRadioItem value={ALL} label="All nodes" />
            {used.map((entry) => (
              <DropdownMenuRadioItem key={entry.id} value={entry.id} label={entry.label} />
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenu>
      </HStack>
      {chosen ? (
        <HStack>
          <Token
            label={chosen.label}
            size="sm"
            color={chosen.tone}
            onRemove={() => setCategory(ALL)}
          />
        </HStack>
      ) : null}
      {used.map((entry) => {
        const nodes = available.filter((node) => node.category === entry.id)
        if (nodes.length === 0) return null
        return (
          <VStack key={entry.id} gap={0.5}>
            <span className="block px-1 pt-1 pb-0.5">
              <Text type="supporting">{entry.label}</Text>
            </span>
            {nodes.map((node) => {
              const icon = NODE_ICONS[node.type]
              return (
                <HoverCard
                  key={node.type}
                  content={<NodeDetails definition={node} />}
                  placement="end"
                  alignment="start"
                  delay={400}
                  hasHoverIndication={false}
                  label={node.label}
                >
                  <Draggable type={node.type}>
                    <Item
                      label={node.label}
                      density="compact"
                      startContent={
                        icon ? <IconTile icon={icon} tone={entry.tone} size="sm" /> : undefined
                      }
                      endContent={<Icon icon={Info} size="sm" color="disabled" />}
                      onClick={() => onAdd(node.type, search ? 'search' : 'click')}
                    />
                  </Draggable>
                </HoverCard>
              )
            })}
          </VStack>
        )
      })}
      {available.length === 0 ? (
        <Text type="supporting">No node matches.</Text>
      ) : (
        <Text type="supporting">Click to add, or drag onto the canvas.</Text>
      )}
    </VStack>
  )
}

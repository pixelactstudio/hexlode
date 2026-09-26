import { Item } from '@astryxdesign/core/Item'
import { VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Search } from 'lucide-react'
import { useState } from 'react'

import { IconTile } from '#/features/app-shell/icon-tile'
import type { NodeRegistry } from '#/features/engine/types'
import { NODE_DRAG_TYPE } from '#/features/studio/constants'
import { CATEGORIES, NODE_ICONS } from '#/features/studio/node-ui'

export function NodeSidebar({
  registry,
  onAdd,
  hasFiles,
}: {
  registry: NodeRegistry
  onAdd: (type: string, method: 'click' | 'search') => void
  hasFiles: boolean
}) {
  const [query, setQuery] = useState('')
  const search = query.trim().toLocaleLowerCase()
  const available = registry
    .list()
    .filter((node) => !(node.type === 'files' && hasFiles))
    .filter(
      (node) =>
        !search ||
        node.label.toLocaleLowerCase().includes(search) ||
        node.description.toLocaleLowerCase().includes(search),
    )

  return (
    <VStack gap={4}>
      <TextInput
        label="Find a node"
        isLabelHidden
        placeholder="Find a node"
        startIcon={Search}
        value={query}
        hasClear
        onChange={setQuery}
      />
      <Text type="supporting">Click a node to add it, or drag it onto the canvas.</Text>
      {CATEGORIES.map((category) => {
        const nodes = available.filter((node) => node.category === category.id)
        if (nodes.length === 0) return null
        return (
          <VStack key={category.id} gap={1}>
            <Text type="label" weight="semibold" color="secondary">
              {category.label}
            </Text>
            {nodes.map((node) => {
              const icon = NODE_ICONS[node.type]
              return (
                // biome-ignore lint/a11y/noStaticElementInteractions: dragging is a pointer shortcut; the Item inside is the accessible button that adds the node.
                <span
                  key={node.type}
                  draggable
                  className="block cursor-grab rounded-md"
                  onDragStart={(event) => {
                    event.dataTransfer.setData(NODE_DRAG_TYPE, node.type)
                    event.dataTransfer.effectAllowed = 'copy'
                  }}
                >
                  <Item
                    label={node.label}
                    description={node.description}
                    descriptionLines={2}
                    density="compact"
                    align="start"
                    startContent={
                      icon ? <IconTile icon={icon} tone={category.tone} size="sm" /> : undefined
                    }
                    onClick={() => onAdd(node.type, search ? 'search' : 'click')}
                  />
                </span>
              )
            })}
          </VStack>
        )
      })}
      {available.length === 0 ? <Text type="supporting">No node matches.</Text> : null}
    </VStack>
  )
}

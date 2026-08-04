import { Heading } from '@astryxdesign/core/Heading'
import { List, ListItem } from '@astryxdesign/core/List'
import { VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'

import type { WorkflowCanvasNode } from '#/features/canvas/types'
import { WORKFLOW_DEFINITIONS, WORKFLOW_KINDS } from '#/features/canvas/workflow/constants'
import type { WorkflowStatus } from '#/features/canvas/workflow/types'

const STATUS_COLORS: Record<WorkflowStatus, 'blue' | 'gray' | 'green' | 'orange' | 'red'> = {
  cancelled: 'orange',
  complete: 'green',
  failed: 'red',
  idle: 'gray',
  processing: 'blue',
  ready: 'blue',
}

interface MobileWorkflowNavigatorProps {
  nodes: WorkflowCanvasNode[]
  onSelect: (nodeId: string) => void
}

export function MobileWorkflowNavigator({ nodes, onSelect }: MobileWorkflowNavigatorProps) {
  const orderedNodes = WORKFLOW_KINDS.flatMap((kind) =>
    nodes.filter((node) => node.data.kind === kind),
  )

  return (
    <List
      density="balanced"
      hasDividers
      listStyle="decimal"
      header={
        <VStack gap={1}>
          <Heading level={2}>Workflow steps</Heading>
          <Text type="supporting">Select a step to review or change its settings.</Text>
        </VStack>
      }
    >
      {orderedNodes.map((node) => {
        const status = node.data.status

        return (
          <ListItem
            key={node.id}
            label={WORKFLOW_DEFINITIONS[node.data.kind].label}
            description={node.data.summary}
            endContent={<Token label={status} color={STATUS_COLORS[status]} size="sm" />}
            isSelected={node.selected}
            onClick={() => onSelect(node.id)}
          />
        )
      })}
    </List>
  )
}

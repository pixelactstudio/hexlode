import { Card } from '@astryxdesign/core/Card'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { StatusDot } from '@astryxdesign/core/StatusDot'
import { Text } from '@astryxdesign/core/Text'
import { Handle, type NodeProps, Position } from '@xyflow/react'

import type { WorkflowCanvasNode } from '#/features/canvas/types'
import { WORKFLOW_DEFINITIONS, WORKFLOW_KINDS } from '#/features/canvas/workflow/constants'

const statusVariants = {
  cancelled: 'neutral',
  complete: 'success',
  failed: 'error',
  idle: 'neutral',
  processing: 'accent',
  ready: 'accent',
} as const

export function WorkflowNode({ data, selected, isConnectable }: NodeProps<WorkflowCanvasNode>) {
  const definition = WORKFLOW_DEFINITIONS[data.kind]
  const index = WORKFLOW_KINDS.indexOf(data.kind) + 1

  return (
    <Card
      width={196}
      padding={3}
      variant={selected ? 'blue' : 'default'}
      elevation={selected ? 'med' : 'low'}
    >
      {data.kind !== 'files' ? (
        <Handle
          type="target"
          position={Position.Left}
          id="image-in"
          isConnectable={isConnectable}
        />
      ) : null}
      <VStack gap={2}>
        <HStack gap={2} hAlign="between" vAlign="center">
          <Text type="code" color="secondary">
            {String(index).padStart(2, '0')}
          </Text>
          <StatusDot
            variant={statusVariants[data.status]}
            label={`${definition.label}: ${data.status}`}
            isPulsing={data.status === 'processing'}
          />
        </HStack>
        <VStack gap={0.5}>
          <Heading level={3}>{definition.label}</Heading>
          <Text type="supporting" color="secondary">
            {data.summary}
          </Text>
        </VStack>
      </VStack>
      {data.kind !== 'download' ? (
        <Handle
          type="source"
          position={Position.Right}
          id="image-out"
          isConnectable={isConnectable}
        />
      ) : null}
    </Card>
  )
}

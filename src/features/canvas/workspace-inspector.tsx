import { VStack } from '@astryxdesign/core/Stack'
import { Tab, TabList } from '@astryxdesign/core/TabList'
import type { ReactNode } from 'react'

export type InspectorView = 'batch' | 'debug' | 'lab' | 'node'

interface WorkspaceInspectorProps {
  batchCount: number
  children: Record<InspectorView, ReactNode>
  onChange: (view: InspectorView) => void
  value: InspectorView
}

export function WorkspaceInspector({
  batchCount,
  children,
  onChange,
  value,
}: WorkspaceInspectorProps) {
  return (
    <VStack gap={4}>
      <TabList
        value={value}
        onChange={(next) => onChange(next as InspectorView)}
        size="sm"
        layout="fill"
        hasDivider
      >
        <Tab value="node" label="Node" />
        <Tab value="batch" label={`Batch (${batchCount})`} />
        <Tab value="lab" label="Lab" />
        <Tab value="debug" label="Debug" />
      </TabList>
      {children[value]}
    </VStack>
  )
}

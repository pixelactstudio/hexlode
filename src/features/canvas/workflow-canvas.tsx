import {
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  type EdgeChange,
  type NodeChange,
  ReactFlow,
} from '@xyflow/react'

import type { WorkflowCanvasEdge, WorkflowCanvasNode } from '#/features/canvas/types'
import { WorkflowNode } from '#/features/canvas/workflow-node'

const NODE_TYPES = { workflow: WorkflowNode }

interface WorkflowCanvasProps {
  edges: WorkflowCanvasEdge[]
  isValidConnection: (connection: Edge | Connection) => boolean
  nodes: WorkflowCanvasNode[]
  onConnect: (connection: Connection) => void
  onEdgesChange: (changes: EdgeChange<WorkflowCanvasEdge>[]) => void
  onNodeDragStart: () => void
  onNodesChange: (changes: NodeChange<WorkflowCanvasNode>[]) => void
  onReconnect: (edge: WorkflowCanvasEdge, connection: Connection) => void
  onReconnectEnd: () => void
  onReconnectStart: (edge: WorkflowCanvasEdge) => void
}

export function WorkflowCanvas({
  edges,
  isValidConnection,
  nodes,
  onConnect,
  onEdgesChange,
  onNodeDragStart,
  onNodesChange,
  onReconnect,
  onReconnectEnd,
  onReconnectStart,
}: WorkflowCanvasProps) {
  return (
    <ReactFlow<WorkflowCanvasNode, WorkflowCanvasEdge>
      className="h-full"
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onReconnect={onReconnect}
      onReconnectStart={(_, edge) => onReconnectStart(edge)}
      onReconnectEnd={onReconnectEnd}
      isValidConnection={isValidConnection}
      onNodeDragStart={onNodeDragStart}
      deleteKeyCode={null}
      edgesReconnectable
      fitView
      fitViewOptions={{ padding: 0.18 }}
      minZoom={0.45}
      maxZoom={1.6}
      aria-label="Editable image processing workflow"
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
      <Controls position="bottom-left" showInteractive={false} />
    </ReactFlow>
  )
}

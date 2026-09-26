import { useToast } from '@astryxdesign/core/Toast'
import {
  Background,
  BackgroundVariant,
  Controls,
  type EdgeChange,
  type Connection as FlowConnection,
  MarkerType,
  type NodeChange,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react'
import { type DragEvent, useMemo, useRef, useState } from 'react'

import { track } from '#/features/analytics/analytics'
import type { NodeRegistry, Pipeline } from '#/features/engine/types'
import type { RunControllerState } from '#/features/runs/run-controller'
import { FIT_VIEW, NODE_DRAG_TYPE } from '#/features/studio/constants'
import { summariseNode } from '#/features/studio/node-summary'
import { PipelineEdgeView, type PipelineFlowEdge } from '#/features/studio/pipeline-edge'
import {
  NODE_WIDTH,
  type PipelineFlowNode,
  PipelineNodeView,
} from '#/features/studio/pipeline-node'
import type { PreviewState, StudioSession } from '#/features/studio/studio-session'
import type { StudioState } from '#/features/studio/studio-store'

const nodeTypes = { pipeline: PipelineNodeView }
const edgeTypes = { pipeline: PipelineEdgeView }

/**
 * React Flow's override variables, set to Astryx tokens. Its stylesheet sets the `-default`
 * variables outside any cascade layer, so only these win over it.
 */
const CANVAS_TOKENS = [
  '[--xy-background-color:var(--color-background-body)]',
  '[--xy-background-pattern-color:var(--color-border-emphasized)]',
  '[--xy-edge-stroke:var(--color-border-emphasized)]',
  '[--xy-edge-stroke-selected:var(--color-accent)]',
  '[--xy-connectionline-stroke:var(--color-accent)]',
  '[--xy-connectionline-stroke-width:2]',
  '[--xy-handle-background-color:var(--color-background-surface)]',
  '[--xy-handle-border-color:var(--color-border-emphasized)]',
  '[--xy-controls-button-background-color:var(--color-background-surface)]',
  '[--xy-controls-button-background-color-hover:var(--color-overlay-hover)]',
  '[--xy-controls-button-color:var(--color-text-primary)]',
  '[--xy-controls-button-color-hover:var(--color-text-primary)]',
  '[--xy-controls-button-border-color:var(--color-border)]',
  '[--xy-controls-box-shadow:var(--shadow-sm)]',
  '[--xy-selection-background-color:var(--color-accent-muted)]',
  '[--xy-selection-border:1px_solid_var(--color-accent)]',
].join(' ')

export function StudioCanvas({
  session,
  registry,
  studio,
  run,
  previews,
}: {
  session: StudioSession
  registry: NodeRegistry
  studio: StudioState
  run: RunControllerState
  previews: PreviewState
}) {
  const { store } = session
  const flow = useReactFlow()
  const showToast = useToast()
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({})
  const dragStart = useRef<Pipeline | null>(null)
  const running = run.running

  const nodes = useMemo<PipelineFlowNode[]>(
    () =>
      studio.pipeline.nodes.map((node) => {
        const definition = registry.get(node.type)
        let ports = [{ id: 'out', label: 'Output' }]
        try {
          if (definition) ports = definition.ports(definition.parseSettings(node.settings))
        } catch {
          // Invalid settings keep the default port.
        }
        let summary = ''
        try {
          if (definition)
            summary = summariseNode(node.type, definition.parseSettings(node.settings))
        } catch {
          // Invalid settings show no summary; the inspector explains them.
        }
        return {
          id: node.id,
          type: 'pipeline',
          position: node.position,
          selected: node.id === studio.selectedNodeId,
          deletable: definition?.hasInput !== false,
          measured: measured[node.id],
          data: {
            type: node.type,
            label: definition?.label ?? node.type,
            category: definition?.category,
            summary,
            hasInput: definition?.hasInput ?? true,
            ports,
            stats: run.stats.status === 'idle' ? undefined : run.stats.nodes[node.id],
            preview: previews.nodes[node.id],
            hasSample: previews.sample !== null,
            running,
          },
        }
      }),
    [
      studio.pipeline.nodes,
      studio.selectedNodeId,
      registry,
      measured,
      run.stats,
      previews.nodes,
      previews.sample,
      running,
    ],
  )

  const edges = useMemo<PipelineFlowEdge[]>(
    () =>
      studio.pipeline.connections.map((connection) => ({
        id: connection.id,
        type: 'pipeline',
        source: connection.source,
        sourceHandle: connection.sourcePort,
        target: connection.target,
        animated: running,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color:
            studio.checks[connection.id]?.status === 'refused'
              ? 'var(--color-error)'
              : 'var(--color-border-emphasized)',
        },
        data: {
          check: studio.checks[connection.id],
          stats: run.stats.status === 'idle' ? undefined : run.stats.connections[connection.id],
          running,
        },
      })),
    [studio.pipeline.connections, studio.checks, run.stats, running],
  )

  const onNodesChange = (changes: NodeChange<PipelineFlowNode>[]) => {
    const positions: Record<string, { x: number; y: number }> = {}
    const removed: string[] = []
    const sizes: Record<string, { width: number; height: number }> = {}
    for (const change of changes) {
      if (change.type === 'position' && change.position) positions[change.id] = change.position
      if (change.type === 'remove') removed.push(change.id)
      if (change.type === 'select' && change.selected) store.select(change.id)
      if (change.type === 'dimensions' && change.dimensions) sizes[change.id] = change.dimensions
    }
    if (Object.keys(sizes).length > 0) setMeasured((current) => ({ ...current, ...sizes }))
    if (Object.keys(positions).length > 0) store.moveNodes(positions)
    if (removed.length > 0) store.removeNodes(removed)
  }

  const onEdgesChange = (changes: EdgeChange<PipelineFlowEdge>[]) => {
    const removed = changes.flatMap((change) => (change.type === 'remove' ? [change.id] : []))
    if (removed.length > 0) store.removeConnections(removed)
  }

  const typeOf = (id: string) => studio.pipeline.nodes.find((node) => node.id === id)?.type ?? ''

  const onConnect = (connection: FlowConnection) => {
    const candidate = {
      source: connection.source,
      sourcePort: connection.sourceHandle ?? 'out',
      target: connection.target,
    }
    const check = store.connect(candidate)
    track('connection_checked', {
      sourceType: typeOf(candidate.source),
      targetType: typeOf(candidate.target),
      decision: check.status,
    })
    if (check.status === 'refused') {
      showToast({ body: check.message, type: 'error', uniqueID: 'connection' })
    } else if (check.status === 'narrows') {
      showToast({ body: check.message, uniqueID: 'connection' })
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    const position = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY })
    const type = event.dataTransfer.getData(NODE_DRAG_TYPE)
    if (type) {
      const id = store.addNode(type, {
        x: position.x - NODE_WIDTH / 2,
        y: position.y - 40,
      })
      if (id) track('node_added', { nodeType: type, method: 'drag' })
      return
    }
    const files = [...event.dataTransfer.files]
    if (files.length > 0) {
      void session.runs.addFiles(files.map((file) => ({ file, relativePath: file.name })))
    }
  }

  return (
    <ReactFlow<PipelineFlowNode, PipelineFlowEdge>
      className={CANVAS_TOKENS}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeDragStart={() => {
        dragStart.current = store.getState().pipeline
      }}
      onNodeDragStop={() => {
        if (dragStart.current) store.commitMove(dragStart.current)
        dragStart.current = null
      }}
      onPaneClick={() => store.select(null)}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={onDrop}
      deleteKeyCode={['Backspace', 'Delete']}
      fitView
      fitViewOptions={FIT_VIEW}
      minZoom={0.2}
      maxZoom={2}
      snapToGrid
      snapGrid={[20, 20]}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} />
      <Controls
        showInteractive={false}
        position="bottom-left"
        className="overflow-hidden rounded-lg"
      />
    </ReactFlow>
  )
}

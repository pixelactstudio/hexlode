import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { ContextMenu, type ContextMenuOption } from '@astryxdesign/core/ContextMenu'
import { HStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { useToast } from '@astryxdesign/core/Toast'
import {
  Background,
  BackgroundVariant,
  Controls,
  type EdgeChange,
  type Connection as FlowConnection,
  MarkerType,
  type NodeChange,
  Panel,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react'
import {
  Copy,
  Maximize,
  PackageCheck,
  Plus,
  Redo2,
  Settings2,
  Trash2,
  Undo2,
  Unlink,
} from 'lucide-react'
import { type DragEvent, type MouseEvent, useMemo, useRef, useState } from 'react'

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
import { track } from '#/features/usage/usage'
import { formatCount } from '#/lib/format'

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

/** Where a new node goes: at a point on the canvas, or connected after another node. */
export interface AddNodeRequest {
  position: { x: number; y: number }
  after?: string
}

type MenuTarget =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | { kind: 'pane'; position: { x: number; y: number } }

/** A hint over the top of the canvas, with an optional action. */
function CanvasHint({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <Card padding={2} elevation="low">
      <HStack gap={3} vAlign="center" paddingInline={1}>
        <Text type="supporting">{text}</Text>
        {action}
      </HStack>
    </Card>
  )
}

export function StudioCanvas({
  session,
  registry,
  studio,
  run,
  previews,
  onAddNode,
  onAddOutput,
}: {
  session: StudioSession
  registry: NodeRegistry
  studio: StudioState
  run: RunControllerState
  previews: PreviewState
  /** Opens the node picker for a new node at a point or after a node. */
  onAddNode: (request: AddNodeRequest) => void
  /** Adds an Output node after the given node, or after the end of the pipeline. */
  onAddOutput: (after?: string) => void
}) {
  const { store } = session
  const flow = useReactFlow()
  const showToast = useToast()
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({})
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null)
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
        if (definition?.hasInput === false) {
          const count = run.sources.length
          summary =
            count > 0 ? `${formatCount(count)} image${count === 1 ? '' : 's'}` : 'No images yet'
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
      run.sources.length,
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
        selected: connection.id === selectedEdge,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color:
            studio.checks[connection.id]?.status === 'refused'
              ? 'var(--color-error)'
              : connection.id === selectedEdge
                ? 'var(--color-accent)'
                : 'var(--color-border-emphasized)',
        },
        data: {
          check: studio.checks[connection.id],
          stats: run.stats.status === 'idle' ? undefined : run.stats.connections[connection.id],
          running,
        },
      })),
    [studio.pipeline.connections, studio.checks, run.stats, running, selectedEdge],
  )

  const onNodesChange = (changes: NodeChange<PipelineFlowNode>[]) => {
    const positions: Record<string, { x: number; y: number }> = {}
    const removed: string[] = []
    const sizes: Record<string, { width: number; height: number }> = {}
    for (const change of changes) {
      if (change.type === 'position' && change.position) positions[change.id] = change.position
      if (change.type === 'remove') removed.push(change.id)
      if (change.type === 'select' && change.selected) {
        store.select(change.id)
        setSelectedEdge(null)
      }
      if (change.type === 'dimensions' && change.dimensions) sizes[change.id] = change.dimensions
    }
    if (Object.keys(sizes).length > 0) setMeasured((current) => ({ ...current, ...sizes }))
    if (Object.keys(positions).length > 0) store.moveNodes(positions)
    if (removed.length > 0) removeNodes(removed, 'keyboard')
  }

  const onEdgesChange = (changes: EdgeChange<PipelineFlowEdge>[]) => {
    const removed = changes.flatMap((change) => (change.type === 'remove' ? [change.id] : []))
    for (const change of changes) {
      if (change.type !== 'select') continue
      if (change.selected) {
        setSelectedEdge(change.id)
        store.select(null)
      } else {
        setSelectedEdge((current) => (current === change.id ? null : current))
      }
    }
    if (removed.length > 0) {
      store.removeConnections(removed)
      setSelectedEdge(null)
    }
  }

  const typeOf = (id: string) => studio.pipeline.nodes.find((node) => node.id === id)?.type ?? ''

  const removeNodes = (ids: string[], method: 'keyboard' | 'menu') => {
    const types = ids.map(typeOf).filter((type) => type && type !== 'files')
    store.removeNodes(ids)
    for (const nodeType of types) track('node_removed', { nodeType, method })
  }

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

  const beside = (id: string) => {
    const node = studio.pipeline.nodes.find((candidate) => candidate.id === id)
    return node ? { x: node.position.x + NODE_WIDTH + 60, y: node.position.y } : { x: 0, y: 0 }
  }

  const menuItems = (): ContextMenuOption[] => {
    if (!menuTarget) return []
    if (menuTarget.kind === 'edge') {
      return [
        {
          label: 'Delete connection',
          icon: Trash2,
          isDisabled: running,
          onClick: () => store.removeConnections([menuTarget.id]),
        },
      ]
    }
    if (menuTarget.kind === 'pane') {
      return [
        {
          label: 'Add node here…',
          icon: Plus,
          isDisabled: running,
          onClick: () => onAddNode({ position: menuTarget.position }),
        },
        { type: 'divider' },
        { label: 'Undo', icon: Undo2, isDisabled: !studio.canUndo, onClick: () => store.undo() },
        { label: 'Redo', icon: Redo2, isDisabled: !studio.canRedo, onClick: () => store.redo() },
        { type: 'divider' },
        { label: 'Fit to screen', icon: Maximize, onClick: () => void flow.fitView(FIT_VIEW) },
      ]
    }
    const node = studio.pipeline.nodes.find((candidate) => candidate.id === menuTarget.id)
    const definition = node ? registry.get(node.type) : undefined
    if (!node || !definition) return []
    const isFiles = definition.hasInput === false
    return [
      {
        label: isFiles ? 'Show images' : 'Settings',
        icon: Settings2,
        onClick: () => store.select(node.id),
      },
      {
        label: 'Add node after…',
        icon: Plus,
        isDisabled: running,
        onClick: () => onAddNode({ position: beside(node.id), after: node.id }),
      },
      ...(node.type === 'output'
        ? []
        : [
            {
              label: 'Add Output after',
              icon: PackageCheck,
              isDisabled: running,
              onClick: () => onAddOutput(node.id),
            },
          ]),
      ...(isFiles
        ? []
        : [
            {
              label: 'Duplicate',
              icon: Copy,
              isDisabled: running,
              onClick: () => store.duplicateNode(node.id),
            },
          ]),
      { type: 'divider' },
      {
        label: 'Disconnect',
        icon: Unlink,
        isDisabled: running,
        onClick: () => store.disconnectNode(node.id),
      },
      ...(isFiles
        ? []
        : [
            {
              label: 'Delete',
              icon: Trash2,
              isDisabled: running,
              onClick: () => removeNodes([node.id], 'menu'),
            },
          ]),
    ]
  }

  const hasOutput = studio.pipeline.nodes.some((node) => node.type === 'output')
  const hasImages = run.sources.length > 0

  return (
    // Shift and right-click opens the browser's own menu instead of the Studio's.
    <div
      className="h-full w-full [&>*]:h-full"
      onContextMenuCapture={(event) => {
        if (event.shiftKey) event.stopPropagation()
      }}
    >
      <ContextMenu items={menuItems()} label="Canvas menu" menuWidth={200} size="sm">
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
          onNodeContextMenu={(_event: MouseEvent, node) => {
            store.select(node.id)
            setSelectedEdge(null)
            setMenuTarget({ kind: 'node', id: node.id })
          }}
          onEdgeContextMenu={(_event: MouseEvent, edge) => {
            setSelectedEdge(edge.id)
            store.select(null)
            setMenuTarget({ kind: 'edge', id: edge.id })
          }}
          onPaneContextMenu={(event) => {
            setMenuTarget({
              kind: 'pane',
              position: flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
            })
          }}
          onPaneClick={() => {
            store.select(null)
            setSelectedEdge(null)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
          }}
          onDrop={onDrop}
          deleteKeyCode={running ? null : ['Backspace', 'Delete']}
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
          {!hasImages || !hasOutput ? (
            <Panel position="top-center">
              {!hasOutput ? (
                <CanvasHint
                  text="Nothing is saved without an Output node."
                  action={
                    <Button
                      label="Add Output"
                      size="sm"
                      isDisabled={running}
                      onClick={() => onAddOutput()}
                    />
                  }
                />
              ) : (
                <CanvasHint text="Drop images anywhere on the canvas to preview every step." />
              )}
            </Panel>
          ) : null}
        </ReactFlow>
      </ContextMenu>
    </div>
  )
}

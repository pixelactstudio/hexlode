/**
 * The pipeline being edited in the Studio: nodes, connections, selection and undo history.
 * Plain TypeScript; the canvas and inspector subscribe to it.
 */
import {
  analysePipeline,
  type ConnectionCandidate,
  type ConnectionCheck,
  checkConnection,
} from '#/features/engine/compatibility'
import type { NodeRegistry, Pipeline, PipelineNode } from '#/features/engine/types'
import type { NamedPipeline } from '#/features/pipelines/types'
import { MAX_UNDO_STEPS, SETTINGS_UNDO_WINDOW_MS } from '#/features/studio/constants'

export interface StudioState {
  pipeline: Pipeline
  name: string
  savedId: string | null
  dirty: boolean
  selectedNodeId: string | null
  checks: Record<string, ConnectionCheck>
  canUndo: boolean
  canRedo: boolean
}

const EMPTY: Pipeline = { nodes: [], connections: [] }

export function createStudioStore(registry: NodeRegistry, now: () => number = () => Date.now()) {
  const listeners = new Set<() => void>()
  let past: Pipeline[] = []
  let future: Pipeline[] = []
  let lastSettingsEdit: { nodeId: string; at: number } | null = null
  let counter = 0
  let state: StudioState = {
    pipeline: EMPTY,
    name: 'Untitled pipeline',
    savedId: null,
    dirty: false,
    selectedNodeId: null,
    checks: {},
    canUndo: false,
    canRedo: false,
  }

  const checksOf = (pipeline: Pipeline) => {
    try {
      return Object.fromEntries(analysePipeline(pipeline, registry).connections)
    } catch {
      return {}
    }
  }

  const emit = (changes: Partial<StudioState>) => {
    state = { ...state, ...changes, canUndo: past.length > 0, canRedo: future.length > 0 }
    for (const listener of listeners) listener()
  }

  /** Records the current pipeline for undo, then replaces it. */
  const change = (pipeline: Pipeline, options: { foldSettingsOf?: string } = {}) => {
    const fold =
      options.foldSettingsOf !== undefined &&
      lastSettingsEdit?.nodeId === options.foldSettingsOf &&
      now() - lastSettingsEdit.at < SETTINGS_UNDO_WINDOW_MS
    if (!fold) past = [...past, state.pipeline].slice(-MAX_UNDO_STEPS)
    future = []
    lastSettingsEdit = options.foldSettingsOf ? { nodeId: options.foldSettingsOf, at: now() } : null
    const selected = pipeline.nodes.some((node) => node.id === state.selectedNodeId)
      ? state.selectedNodeId
      : null
    emit({ pipeline, dirty: true, checks: checksOf(pipeline), selectedNodeId: selected })
  }

  const nextId = (type: string) => {
    let id: string
    do {
      counter += 1
      id = `${type}-${counter}`
    } while (state.pipeline.nodes.some((node) => node.id === id))
    return id
  }

  const isStart = (node: PipelineNode) => registry.get(node.type)?.hasInput === false

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    load({ name, pipeline }: NamedPipeline, savedId: string | null = null) {
      past = []
      future = []
      lastSettingsEdit = null
      emit({
        pipeline,
        name,
        savedId,
        dirty: false,
        selectedNodeId: null,
        checks: checksOf(pipeline),
      })
    },
    /** Adds a node with default settings. Returns null for a second Files node. */
    addNode(type: string, position: { x: number; y: number }) {
      const definition = registry.get(type)
      if (!definition) return null
      if (!definition.hasInput && state.pipeline.nodes.some(isStart)) return null
      const id = nextId(type)
      change({
        ...state.pipeline,
        nodes: [...state.pipeline.nodes, { id, type, settings: {}, position }],
      })
      emit({ selectedNodeId: id })
      return id
    },
    check(candidate: ConnectionCandidate) {
      return checkConnection(state.pipeline, registry, candidate)
    },
    connect(candidate: ConnectionCandidate): ConnectionCheck {
      const check = checkConnection(state.pipeline, registry, candidate)
      if (check.status === 'refused') return check
      const id = `${candidate.source}-${candidate.sourcePort}-${candidate.target}`
      change({
        ...state.pipeline,
        connections: [...state.pipeline.connections, { id, ...candidate }],
      })
      return check
    },
    removeNodes(ids: string[]) {
      const removable = new Set(
        state.pipeline.nodes
          .filter((node) => ids.includes(node.id) && !isStart(node))
          .map((n) => n.id),
      )
      if (removable.size === 0) return
      change({
        nodes: state.pipeline.nodes.filter((node) => !removable.has(node.id)),
        connections: state.pipeline.connections.filter(
          (connection) => !removable.has(connection.source) && !removable.has(connection.target),
        ),
      })
    },
    removeConnections(ids: string[]) {
      if (!state.pipeline.connections.some((connection) => ids.includes(connection.id))) return
      change({
        ...state.pipeline,
        connections: state.pipeline.connections.filter(
          (connection) => !ids.includes(connection.id),
        ),
      })
    },
    updateSettings(nodeId: string, settings: Record<string, unknown>) {
      const node = state.pipeline.nodes.find((candidate) => candidate.id === nodeId)
      const definition = node && registry.get(node.type)
      if (!node || !definition) return
      const merged = { ...node.settings, ...settings }
      try {
        definition.parseSettings(merged)
      } catch {
        return
      }
      const ports = new Set(
        definition.ports(definition.parseSettings(merged)).map((port) => port.id),
      )
      change(
        {
          nodes: state.pipeline.nodes.map((candidate) =>
            candidate.id === nodeId ? { ...candidate, settings: merged } : candidate,
          ),
          // A Filter rule that was removed takes its connections with it.
          connections: state.pipeline.connections.filter(
            (connection) => connection.source !== nodeId || ports.has(connection.sourcePort),
          ),
        },
        { foldSettingsOf: nodeId },
      )
    },
    /** Moves nodes without an undo step. Call `commitMove` when the drag ends. */
    moveNodes(positions: Record<string, { x: number; y: number }>) {
      state = {
        ...state,
        pipeline: {
          ...state.pipeline,
          nodes: state.pipeline.nodes.map((node) =>
            positions[node.id] ? { ...node, position: positions[node.id] } : node,
          ),
        },
      }
      for (const listener of listeners) listener()
    },
    commitMove(before: Pipeline) {
      past = [...past, before].slice(-MAX_UNDO_STEPS)
      future = []
      lastSettingsEdit = null
      emit({ dirty: true })
    },
    select(nodeId: string | null) {
      emit({ selectedNodeId: nodeId })
    },
    rename(name: string) {
      emit({ name, dirty: true })
    },
    markSaved(savedId: string, name: string) {
      emit({ savedId, name, dirty: false })
    },
    undo() {
      const previous = past.at(-1)
      if (!previous) return
      past = past.slice(0, -1)
      future = [state.pipeline, ...future]
      lastSettingsEdit = null
      emit({ pipeline: previous, dirty: true, checks: checksOf(previous) })
    },
    redo() {
      const next = future[0]
      if (!next) return
      future = future.slice(1)
      past = [...past, state.pipeline]
      lastSettingsEdit = null
      emit({ pipeline: next, dirty: true, checks: checksOf(next) })
    },
  }
}

export type StudioStore = ReturnType<typeof createStudioStore>

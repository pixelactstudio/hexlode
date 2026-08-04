import { AppShell } from '@astryxdesign/core/AppShell'
import { useMediaQuery } from '@astryxdesign/core/hooks'
import { Layout, LayoutContent, LayoutPanel } from '@astryxdesign/core/Layout'
import { Section } from '@astryxdesign/core/Section'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { StatusDot } from '@astryxdesign/core/StatusDot'
import { Text } from '@astryxdesign/core/Text'
import { TopNav, TopNavHeading } from '@astryxdesign/core/TopNav'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  MarkerType,
  type NodeChange,
  reconnectEdge,
} from '@xyflow/react'
import { useEffect, useRef, useState } from 'react'

import {
  createCanvasNode,
  createDisplayEdges,
  createDisplayNodes,
  createInitialCanvas,
  getCanvasConnectionIssue,
  getNodeStatus,
  outputFileName,
  toEdgeModels,
  toNodeModels,
} from '#/features/canvas/canvas-model'
import type {
  GraphSnapshot,
  ProcessedImage,
  RunState,
  SelectedImage,
  WorkflowCanvasEdge,
  WorkflowCanvasNode,
} from '#/features/canvas/types'
import { WORKFLOW_DEFINITIONS, WORKFLOW_KINDS } from '#/features/canvas/workflow/constants'
import {
  compileWorkflow,
  createNodePosition,
  WorkflowGraphError,
} from '#/features/canvas/workflow/graph'
import type { WorkflowNodeModel } from '#/features/canvas/workflow/types'
import { WorkflowCanvas } from '#/features/canvas/workflow-canvas'
import { WorkflowInspector } from '#/features/canvas/workflow-inspector'
import { WorkflowToolbar } from '#/features/canvas/workflow-toolbar'
import { ImageValidationError, inspectImageHeader } from '#/features/image-input/validators'
import { DEFAULT_MAX_DIMENSION, DEFAULT_WEBP_QUALITY } from '#/features/processing/constants'
import { ImageProcessor, ProcessingError } from '#/features/processing/image-processor'
import { createProcessingPlan } from '#/features/processing/processing-plan'
import type { WorkerProgress } from '#/features/processing/worker/protocol'
import { createId } from '#/lib/create-id'

const HISTORY_LIMIT = 50
const INITIAL_PROGRESS = 4
const WORKER_STAGE = {
  decode: { nodeIndex: 1, label: 'Decoding source image' },
  resize: { nodeIndex: 2, label: 'Resizing pixels' },
  encode: { nodeIndex: 3, label: 'Encoding WebP' },
} as const

const initialCanvas = createInitialCanvas()

interface History {
  past: GraphSnapshot[]
  future: GraphSnapshot[]
}

export function CanvasWorkbench() {
  const isNarrow = useMediaQuery('(max-width: 48rem)')
  const [processor] = useState(() => new ImageProcessor())
  const outputBlobRef = useRef<Blob | null>(null)
  const sourceUrlRef = useRef<string | null>(null)
  const resultUrlRef = useRef<string | null>(null)
  const reconnectingEdgeIdRef = useRef<string | null>(null)
  const selectionIdRef = useRef(0)
  const runIdRef = useRef(0)

  const [nodes, setNodes] = useState<WorkflowCanvasNode[]>(initialCanvas.nodes)
  const [edges, setEdges] = useState<WorkflowCanvasEdge[]>(initialCanvas.edges)
  const [history, setHistory] = useState<History>({ past: [], future: [] })
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null)
  const [result, setResult] = useState<ProcessedImage | null>(null)
  const [maxDimension, setMaxDimension] = useState(DEFAULT_MAX_DIMENSION)
  const [quality, setQuality] = useState(DEFAULT_WEBP_QUALITY)
  const [runState, setRunState] = useState<RunState>('idle')
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('Waiting for an image')
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
  const [failedNodeId, setFailedNodeId] = useState<string | null>(null)
  const [cancelledNodeId, setCancelledNodeId] = useState<string | null>(null)
  const [downloaded, setDownloaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [graphIssue, setGraphIssue] = useState<string | null>(null)
  const [isInspecting, setIsInspecting] = useState(false)

  useEffect(() => {
    return () => {
      runIdRef.current += 1
      processor.dispose()
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    }
  }, [processor])

  const selectedNode = nodes.find((node) => node.selected) ?? null
  const selectedEdges = edges.filter((edge) => edge.selected)
  const missingKind = WORKFLOW_KINDS.find((kind) => !nodes.some((node) => node.data.kind === kind))
  const savings = result && selectedImage ? (1 - result.size / selectedImage.file.size) * 100 : null
  const estimatedPeakBytes = calculateEstimatedPeakBytes()
  const runtime = {
    activeNodeId,
    cancelledNodeId,
    downloaded,
    failedNodeId,
    maxDimension,
    quality,
    result,
    savings,
    selectedImage,
  }
  const displayNodes = createDisplayNodes(nodes, runtime)
  const displayEdges = createDisplayEdges(edges, nodes, runtime)
  const currentStatus = selectedNode ? getNodeStatus(selectedNode, runtime) : 'idle'

  function calculateEstimatedPeakBytes() {
    if (!selectedImage) return null

    try {
      return createProcessingPlan(selectedImage.info, { maxDimension, quality }).estimatedPeakBytes
    } catch {
      return null
    }
  }

  function snapshot(): GraphSnapshot {
    return structuredClone({ nodes, edges })
  }

  function recordHistory(value = snapshot()) {
    setHistory((current) => ({
      past: [...current.past, value].slice(-HISTORY_LIMIT),
      future: [],
    }))
  }

  function restoreGraph(value: GraphSnapshot) {
    setNodes(value.nodes)
    setEdges(value.edges)
    setGraphIssue(null)
  }

  function undo() {
    const previous = history.past.at(-1)
    if (!previous) return

    setHistory({
      past: history.past.slice(0, -1),
      future: [...history.future, snapshot()],
    })
    restoreGraph(previous)
  }

  function redo() {
    const next = history.future.at(-1)
    if (!next) return

    setHistory({
      past: [...history.past, snapshot()],
      future: history.future.slice(0, -1),
    })
    restoreGraph(next)
  }

  function releaseResult() {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    resultUrlRef.current = null
    outputBlobRef.current = null
    setResult(null)
  }

  function invalidateResult() {
    releaseResult()
    setActiveNodeId(null)
    setCancelledNodeId(null)
    setDownloaded(false)
    setError(null)
    setFailedNodeId(null)
    setRunState('idle')
    setProgress(0)
    setProgressLabel('Settings changed. Run the pipeline again.')
  }

  function changeMaxDimension(value: number) {
    setMaxDimension(value)
    invalidateResult()
  }

  function changeQuality(value: number) {
    setQuality(value)
    invalidateResult()
  }

  function resetRunState() {
    setRunState('idle')
    setProgress(0)
    setActiveNodeId(null)
    setFailedNodeId(null)
    setCancelledNodeId(null)
    setDownloaded(false)
    setError(null)
    releaseResult()
  }

  async function selectFile(value: File | File[] | null) {
    const file = Array.isArray(value) ? value[0] : value
    const selectionId = ++selectionIdRef.current
    runIdRef.current += 1
    processor.cancel()
    resetRunState()

    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
    sourceUrlRef.current = null
    setSelectedImage(null)
    if (!file) return

    setIsInspecting(true)
    try {
      const info = inspectImageHeader(await file.arrayBuffer(), file.type)
      if (selectionId !== selectionIdRef.current) return

      const previewUrl = URL.createObjectURL(file)
      sourceUrlRef.current = previewUrl
      setSelectedImage({ file, info, previewUrl })
      setProgressLabel('Image inspected and ready')
    } catch (reason) {
      if (selectionId !== selectionIdRef.current) return

      const message =
        reason instanceof ImageValidationError
          ? reason.message
          : 'The image could not be inspected.'
      setError(message)
      setFailedNodeId(nodes.find((node) => node.data.kind === 'inspect')?.id ?? null)
    } finally {
      if (selectionId === selectionIdRef.current) setIsInspecting(false)
    }
  }

  function updateWorkerProgress(
    update: WorkerProgress,
    sequence: string[],
    setFailureNode: (nodeId: string) => void,
  ) {
    const stage = WORKER_STAGE[update.stage]
    const nodeId = sequence[stage.nodeIndex]
    if (!nodeId) return

    setFailureNode(nodeId)
    setActiveNodeId(nodeId)
    setProgress(update.progress)
    setProgressLabel(stage.label)
  }

  async function processImage() {
    if (!selectedImage) {
      setGraphIssue('Select the Files node and choose a JPEG or PNG before running.')
      return
    }

    let sequence: string[]
    try {
      sequence = compileWorkflow(toNodeModels(nodes), toEdgeModels(edges))
      createProcessingPlan(selectedImage.info, { maxDimension, quality })
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'The workflow is not ready to run.'
      if (reason instanceof WorkflowGraphError) setGraphIssue(message)
      else setError(message)
      return
    }

    const runId = ++runIdRef.current
    let failureNodeId = sequence[1]
    setGraphIssue(null)
    setError(null)
    releaseResult()
    setRunState('processing')
    setProgress(INITIAL_PROGRESS)
    setActiveNodeId(sequence[1])
    setFailedNodeId(null)
    setCancelledNodeId(null)
    setDownloaded(false)
    setProgressLabel('Preparing image')

    try {
      const buffer = await selectedImage.file.arrayBuffer()
      if (runId !== runIdRef.current) return

      const workerResult = await processor.process(
        buffer,
        selectedImage.info.mimeType,
        { maxDimension, quality },
        (update) => {
          if (runId !== runIdRef.current) return
          updateWorkerProgress(update, sequence, (nodeId) => {
            failureNodeId = nodeId
          })
        },
      )
      if (runId !== runIdRef.current) return

      const blob = new Blob([workerResult.output], { type: workerResult.mimeType })
      resultUrlRef.current = URL.createObjectURL(blob)
      outputBlobRef.current = blob
      setResult({
        width: workerResult.width,
        height: workerResult.height,
        size: blob.size,
        durationMs: workerResult.durationMs,
        warnings: workerResult.warnings,
      })
      setProgress(100)
      setProgressLabel('WebP ready to download')
      setRunState('complete')
      setActiveNodeId(null)
    } catch (reason) {
      if (runId !== runIdRef.current) return

      const wasCancelled = reason instanceof ProcessingError && reason.code === 'cancelled'
      setRunState(wasCancelled ? 'cancelled' : 'idle')
      setProgress(0)
      setActiveNodeId(null)
      setProgressLabel(wasCancelled ? 'Processing cancelled' : 'Processing stopped')
      if (!wasCancelled) {
        setFailedNodeId(failureNodeId)
        setError(reason instanceof Error ? reason.message : 'The image could not be processed.')
      }
    }
  }

  function cancelProcessing() {
    runIdRef.current += 1
    processor.cancel()
    setCancelledNodeId(activeNodeId)
    setActiveNodeId(null)
    setRunState('cancelled')
    setProgress(0)
    setProgressLabel('Processing cancelled')
  }

  function downloadResult() {
    const blob = outputBlobRef.current
    if (!blob || !selectedImage) return

    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = outputFileName(selectedImage.file.name)
    link.click()
    setDownloaded(true)
    setTimeout(() => URL.revokeObjectURL(link.href), 0)
  }

  function addMissingNode() {
    if (!missingKind) {
      setGraphIssue('All supported starter nodes are already on the canvas.')
      return
    }

    recordHistory()
    const kindIndex = WORKFLOW_KINDS.indexOf(missingKind)
    const model: WorkflowNodeModel = {
      id: `${missingKind}-${createId()}`,
      data: { kind: missingKind },
      position: createNodePosition(kindIndex),
    }
    setNodes((current) => [
      ...current.map((node) => ({ ...node, selected: false })),
      createCanvasNode(model, true),
    ])
    setGraphIssue(`Connect the restored ${WORKFLOW_DEFINITIONS[missingKind].label} node.`)
  }

  function deleteSelected() {
    const selectedNodeIds = new Set(nodes.filter((node) => node.selected).map((node) => node.id))
    if (!selectedNodeIds.size && !selectedEdges.length) {
      setGraphIssue('Select a node or connection to delete.')
      return
    }

    recordHistory()
    setNodes((current) => current.filter((node) => !selectedNodeIds.has(node.id)))
    setEdges((current) =>
      current.filter(
        (edge) =>
          !edge.selected && !selectedNodeIds.has(edge.source) && !selectedNodeIds.has(edge.target),
      ),
    )
    setGraphIssue('Restore and reconnect missing nodes before running.')
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target
      const isFormControl =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      if (isFormControl) return

      const key = event.key.toLowerCase()
      const hasCommandModifier = event.metaKey || event.ctrlKey
      if (hasCommandModifier && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      } else if (hasCommandModifier && key === 'y') {
        event.preventDefault()
        redo()
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        deleteSelected()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  function onNodesChange(changes: NodeChange<WorkflowCanvasNode>[]) {
    setNodes((current) => applyNodeChanges(changes, current))
  }

  function onEdgesChange(changes: EdgeChange<WorkflowCanvasEdge>[]) {
    setEdges((current) => applyEdgeChanges(changes, current))
  }

  function onConnect(connection: Connection) {
    const issue = getCanvasConnectionIssue(connection, nodes, edges)
    if (issue) {
      setGraphIssue(issue)
      return
    }

    recordHistory()
    setEdges((current) =>
      addEdge(
        {
          ...connection,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed },
        },
        current,
      ),
    )
    setGraphIssue(null)
  }

  function onReconnect(oldEdge: WorkflowCanvasEdge, connection: Connection) {
    const issue = getCanvasConnectionIssue(connection, nodes, edges, oldEdge.id)
    if (issue) {
      setGraphIssue(issue)
      return
    }

    recordHistory()
    setEdges((current) => reconnectEdge(oldEdge, connection, current))
    setGraphIssue(null)
  }

  function isValidConnection(connection: Edge | Connection) {
    const issue = getCanvasConnectionIssue(
      connection,
      nodes,
      edges,
      reconnectingEdgeIdRef.current ?? undefined,
    )
    if (issue) setGraphIssue(issue)
    return !issue
  }

  function startReconnect(edge: WorkflowCanvasEdge) {
    reconnectingEdgeIdRef.current = edge.id
  }

  function endReconnect() {
    reconnectingEdgeIdRef.current = null
  }

  const actions = {
    addMissingNode,
    cancelProcessing,
    deleteSelected,
    downloadResult,
    processImage,
    redo,
    selectFile,
    setMaxDimension: changeMaxDimension,
    setQuality: changeQuality,
    undo,
  }
  const inspector = (
    <WorkflowInspector
      actions={actions}
      canRedo={history.future.length > 0}
      canUndo={history.past.length > 0}
      currentStatus={currentStatus}
      isNarrow={isNarrow}
      missingKind={missingKind}
      state={{
        downloaded,
        error,
        estimatedPeakBytes,
        graphIssue,
        isInspecting,
        maxDimension,
        progress,
        progressLabel,
        quality,
        result,
        resultUrl: resultUrlRef.current,
        runState,
        savings,
        selectedImage,
        selectedNode,
      }}
    />
  )
  const toolbar = (
    <WorkflowToolbar
      canRedo={history.future.length > 0}
      canUndo={history.past.length > 0}
      error={error}
      isNarrow={isNarrow}
      isProcessing={runState === 'processing'}
      missingKind={missingKind}
      onAddMissingNode={addMissingNode}
      onCancel={cancelProcessing}
      onDelete={deleteSelected}
      onProcess={processImage}
      onRedo={redo}
      onUndo={undo}
    />
  )
  const canvas = (
    <WorkflowCanvas
      edges={displayEdges}
      isNarrow={isNarrow}
      isValidConnection={isValidConnection}
      nodes={displayNodes}
      onConnect={onConnect}
      onEdgesChange={onEdgesChange}
      onNodeDragStart={() => recordHistory()}
      onNodesChange={onNodesChange}
      onReconnect={onReconnect}
      onReconnectEnd={endReconnect}
      onReconnectStart={startReconnect}
    />
  )

  return (
    <AppShell
      height="fill"
      variant="surface"
      contentPadding={0}
      topNav={
        <TopNav
          heading={<TopNavHeading heading="Hexlode" subheading="Visual image workspace" />}
          endContent={
            <HStack gap={1} vAlign="center">
              <StatusDot variant="success" label="Processing stays on this device" />
              <Text type="supporting">On-device</Text>
            </HStack>
          }
        />
      }
    >
      {isNarrow ? (
        <VStack gap={0}>
          {toolbar}
          {canvas}
          <Section variant="section" padding={4} dividers={['top']}>
            {inspector}
          </Section>
        </VStack>
      ) : (
        <Layout
          header={toolbar}
          content={
            <LayoutContent padding={0} isScrollable={false} label="Workflow canvas">
              {canvas}
            </LayoutContent>
          }
          end={
            <LayoutPanel width={380} hasDivider padding={5} label="Node inspector">
              {inspector}
            </LayoutPanel>
          }
        />
      )}
    </AppShell>
  )
}

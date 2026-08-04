import { AppShell } from '@astryxdesign/core/AppShell'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { ButtonGroup } from '@astryxdesign/core/ButtonGroup'
import { FileInput } from '@astryxdesign/core/FileInput'
import { Heading } from '@astryxdesign/core/Heading'
import { useMediaQuery } from '@astryxdesign/core/hooks'
import { Layout, LayoutContent, LayoutPanel } from '@astryxdesign/core/Layout'
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList'
import { NumberInput } from '@astryxdesign/core/NumberInput'
import { ProgressBar } from '@astryxdesign/core/ProgressBar'
import { Section } from '@astryxdesign/core/Section'
import { Slider } from '@astryxdesign/core/Slider'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { StatusDot } from '@astryxdesign/core/StatusDot'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { Toolbar } from '@astryxdesign/core/Toolbar'
import { TopNav, TopNavHeading } from '@astryxdesign/core/TopNav'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  type EdgeChange,
  MarkerType,
  type NodeChange,
  ReactFlow,
  reconnectEdge,
} from '@xyflow/react'
import { useEffect, useRef, useState } from 'react'
import {
  compileWorkflow,
  createStarterGraph,
  getConnectionIssue,
  type WorkflowEdgeModel,
  WorkflowGraphError,
  type WorkflowKind,
  type WorkflowNodeModel,
  type WorkflowStatus,
  workflowDefinitions,
  workflowKinds,
} from '#/features/canvas/workflow'
import { type WorkflowCanvasNode, WorkflowNode } from '#/features/canvas/workflow-node'
import { ImageComparison } from '#/features/comparison/image-comparison'
import {
  type ImageInfo,
  ImageValidationError,
  inspectImageHeader,
  MAX_INPUT_BYTES,
} from '#/features/image-input/image-validation'
import { ImageProcessor, ProcessingError } from '#/features/processing/image-processor'
import {
  createProcessingPlan,
  DEFAULT_MAX_DIMENSION,
  DEFAULT_WEBP_QUALITY,
  MAX_OUTPUT_DIMENSION,
} from '#/features/processing/processing-plan'

interface SelectedImage {
  file: File
  info: ImageInfo
  previewUrl: string
}

interface ProcessedImage {
  durationMs: number
  height: number
  size: number
  warnings: string[]
  width: number
}

interface GraphSnapshot {
  nodes: WorkflowCanvasNode[]
  edges: WorkflowCanvasEdge[]
}

type RunState = 'cancelled' | 'complete' | 'idle' | 'processing'
type WorkflowCanvasEdge = Edge

const nodeTypes = { workflow: WorkflowNode }

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function outputName(name: string) {
  return `${name.replace(/\.[^.]+$/, '') || 'hexlode-output'}.webp`
}

function toNodeModels(nodes: WorkflowCanvasNode[]): WorkflowNodeModel[] {
  return nodes.map((node) => ({
    id: node.id,
    data: { kind: node.data.kind },
    position: node.position,
  }))
}

function toEdgeModels(edges: WorkflowCanvasEdge[]): WorkflowEdgeModel[] {
  return edges.map(({ id, source, target }) => ({ id, source, target }))
}

function createCanvasNode(model: WorkflowNodeModel, selected = false): WorkflowCanvasNode {
  return {
    ...model,
    selected,
    type: 'workflow',
    data: {
      kind: model.data.kind,
      status: 'idle',
      summary: workflowDefinitions[model.data.kind].summary,
    },
  }
}

function createCanvasEdge(model: WorkflowEdgeModel): WorkflowCanvasEdge {
  return {
    ...model,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
  }
}

const starterGraph = createStarterGraph()
const initialNodes = starterGraph.nodes.map((node) => createCanvasNode(node, node.id === 'files'))
const initialEdges = starterGraph.edges.map(createCanvasEdge)

export function CanvasWorkbench() {
  const isNarrow = useMediaQuery('(max-width: 48rem)')
  const processorRef = useRef(new ImageProcessor())
  const outputBlobRef = useRef<Blob | null>(null)
  const sourceUrlRef = useRef<string | null>(null)
  const resultUrlRef = useRef<string | null>(null)
  const selectionIdRef = useRef(0)
  const runIdRef = useRef(0)
  const pastRef = useRef<GraphSnapshot[]>([])
  const futureRef = useRef<GraphSnapshot[]>([])

  const [nodes, setNodes] = useState<WorkflowCanvasNode[]>(initialNodes)
  const [edges, setEdges] = useState<WorkflowCanvasEdge[]>(initialEdges)
  const [, setHistoryRevision] = useState(0)
  const [selected, setSelected] = useState<SelectedImage | null>(null)
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
      processorRef.current.dispose()
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    }
  }, [])

  const selectedNode = nodes.find((node) => node.selected) ?? null
  const selectedKind = selectedNode?.data.kind ?? null
  const selectedEdges = edges.filter((edge) => edge.selected)
  const missingKind = workflowKinds.find((kind) => !nodes.some((node) => node.data.kind === kind))

  function snapshot(): GraphSnapshot {
    return structuredClone({ nodes, edges })
  }

  function recordHistory(value = snapshot()) {
    pastRef.current = [...pastRef.current, value].slice(-50)
    futureRef.current = []
    setHistoryRevision((revision) => revision + 1)
  }

  function restore(value: GraphSnapshot) {
    setNodes(value.nodes)
    setEdges(value.edges)
    setGraphIssue(null)
    setHistoryRevision((revision) => revision + 1)
  }

  function undo() {
    const previous = pastRef.current.pop()
    if (!previous) return
    futureRef.current.push(snapshot())
    restore(previous)
  }

  function redo() {
    const next = futureRef.current.pop()
    if (!next) return
    pastRef.current.push(snapshot())
    restore(next)
  }

  function clearResult() {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    resultUrlRef.current = null
    outputBlobRef.current = null
    setResult(null)
  }

  async function selectFile(value: File | File[] | null) {
    const file = Array.isArray(value) ? value[0] : value
    const selectionId = ++selectionIdRef.current
    runIdRef.current += 1
    processorRef.current.cancel()
    setRunState('idle')
    setProgress(0)
    setActiveNodeId(null)
    setFailedNodeId(null)
    setCancelledNodeId(null)
    setDownloaded(false)
    setError(null)
    clearResult()

    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
    sourceUrlRef.current = null
    setSelected(null)
    if (!file) return

    setIsInspecting(true)
    try {
      const info = inspectImageHeader(await file.arrayBuffer(), file.type)
      if (selectionId !== selectionIdRef.current) return
      const previewUrl = URL.createObjectURL(file)
      sourceUrlRef.current = previewUrl
      setSelected({ file, info, previewUrl })
      setProgressLabel('Image inspected and ready')
    } catch (reason) {
      if (selectionId !== selectionIdRef.current) return
      setError(
        reason instanceof ImageValidationError
          ? reason.message
          : 'The image could not be inspected.',
      )
      setFailedNodeId(nodes.find((node) => node.data.kind === 'inspect')?.id ?? null)
    } finally {
      if (selectionId === selectionIdRef.current) setIsInspecting(false)
    }
  }

  async function processImage() {
    if (!selected) {
      setGraphIssue('Select the Files node and choose a JPEG or PNG before running.')
      return
    }

    let sequence: string[]
    try {
      sequence = compileWorkflow(toNodeModels(nodes), toEdgeModels(edges))
      createProcessingPlan(selected.info, { maxDimension, quality })
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
    clearResult()
    setRunState('processing')
    setProgress(4)
    setActiveNodeId(sequence[1])
    setFailedNodeId(null)
    setCancelledNodeId(null)
    setDownloaded(false)
    setProgressLabel('Preparing image')

    try {
      const buffer = await selected.file.arrayBuffer()
      if (runId !== runIdRef.current) return

      const workerResult = await processorRef.current.process(
        buffer,
        selected.info.mimeType,
        { maxDimension, quality },
        (update) => {
          if (runId !== runIdRef.current) return
          const index = update.stage === 'decode' ? 1 : update.stage === 'resize' ? 2 : 3
          failureNodeId = sequence[index]
          setActiveNodeId(sequence[index])
          setProgress(update.progress)
          setProgressLabel(
            update.stage === 'decode'
              ? 'Decoding source image'
              : update.stage === 'resize'
                ? 'Resizing pixels'
                : 'Encoding WebP',
          )
        },
      )
      if (runId !== runIdRef.current) return

      const blob = new Blob([workerResult.output], { type: workerResult.mimeType })
      resultUrlRef.current = URL.createObjectURL(blob)
      outputBlobRef.current = blob
      setActiveNodeId(sequence[4])
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
    processorRef.current.cancel()
    setCancelledNodeId(activeNodeId)
    setActiveNodeId(null)
    setRunState('cancelled')
    setProgress(0)
    setProgressLabel('Processing cancelled')
  }

  function downloadResult() {
    const blob = outputBlobRef.current
    if (!blob || !selected) return
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = outputName(selected.file.name)
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
    const index = workflowKinds.indexOf(missingKind)
    const model: WorkflowNodeModel = {
      id: `${missingKind}-${crypto.randomUUID()}`,
      data: { kind: missingKind },
      position: { x: index * 240, y: index % 2 === 0 ? 80 : 180 },
    }
    setNodes((current) => [
      ...current.map((node) => ({ ...node, selected: false })),
      createCanvasNode(model, true),
    ])
    setGraphIssue(`Connect the restored ${workflowDefinitions[missingKind].label} node.`)
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
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
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
    const issue = getConnectionIssue(connection, toNodeModels(nodes), toEdgeModels(edges))
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
    const issue = getConnectionIssue(
      connection,
      toNodeModels(nodes),
      toEdgeModels(edges),
      oldEdge.id,
    )
    if (issue) {
      setGraphIssue(issue)
      return
    }
    recordHistory()
    setEdges((current) => reconnectEdge(oldEdge, connection, current))
    setGraphIssue(null)
  }

  function isValidConnection(connection: Edge | Connection) {
    const issue = getConnectionIssue(connection, toNodeModels(nodes), [])
    if (issue) setGraphIssue(issue)
    return !issue
  }

  const savings = result && selected ? (1 - result.size / selected.file.size) * 100 : null
  let estimatedPeak: number | null = null
  if (selected) {
    try {
      estimatedPeak = createProcessingPlan(selected.info, {
        maxDimension,
        quality,
      }).estimatedPeakBytes
    } catch {
      estimatedPeak = null
    }
  }

  function nodeStatus(node: WorkflowCanvasNode): WorkflowStatus {
    if (node.id === activeNodeId) return 'processing'
    if (node.id === failedNodeId) return 'failed'
    if (node.id === cancelledNodeId) return 'cancelled'

    switch (node.data.kind) {
      case 'files':
      case 'inspect':
        return selected ? 'complete' : 'idle'
      case 'resize':
      case 'webp':
        return result ? 'complete' : selected ? 'ready' : 'idle'
      case 'compare':
        return result ? 'complete' : 'idle'
      case 'download':
        return downloaded ? 'complete' : result ? 'ready' : 'idle'
    }
  }

  function nodeSummary(kind: WorkflowKind) {
    switch (kind) {
      case 'files':
        return selected ? selected.file.name : workflowDefinitions.files.summary
      case 'inspect':
        return selected
          ? `${selected.info.width} × ${selected.info.height} ${selected.info.format.toUpperCase()}`
          : workflowDefinitions.inspect.summary
      case 'resize':
        return `Max ${maxDimension} px`
      case 'webp':
        return `Quality ${quality}%`
      case 'compare':
        return savings === null
          ? workflowDefinitions.compare.summary
          : savings >= 0
            ? `${savings.toFixed(1)}% smaller`
            : `${Math.abs(savings).toFixed(1)}% larger`
      case 'download':
        return selected && result
          ? outputName(selected.file.name)
          : workflowDefinitions.download.summary
    }
  }

  const displayNodes = nodes.map((node) => ({
    ...node,
    data: { ...node.data, status: nodeStatus(node), summary: nodeSummary(node.data.kind) },
  }))
  const displayEdges = edges.map((edge) => {
    const sourceKind = nodes.find((node) => node.id === edge.source)?.data.kind
    const label =
      sourceKind === 'webp' || sourceKind === 'compare'
        ? result
          ? formatBytes(result.size)
          : undefined
        : selected
          ? formatBytes(selected.file.size)
          : undefined
    return { ...edge, animated: edge.target === activeNodeId, label }
  })

  const currentStatus: WorkflowStatus = selectedNode ? nodeStatus(selectedNode) : 'idle'

  const inspector = (
    <VStack gap={5}>
      {selectedNode ? (
        <VStack gap={1}>
          <HStack gap={2} hAlign="between" vAlign="center">
            <Text type="code" color="secondary">
              NODE {String(workflowKinds.indexOf(selectedNode.data.kind) + 1).padStart(2, '0')}
            </Text>
            <Token
              label={currentStatus}
              size="sm"
              color={currentStatus === 'failed' ? 'red' : 'gray'}
            />
          </HStack>
          <Heading level={2}>{workflowDefinitions[selectedNode.data.kind].label}</Heading>
          <Text color="secondary">{workflowDefinitions[selectedNode.data.kind].description}</Text>
        </VStack>
      ) : (
        <VStack gap={1}>
          <Heading level={2}>Inspector</Heading>
          <Text color="secondary">Select a node to edit its settings.</Text>
        </VStack>
      )}

      {graphIssue ? (
        <Banner status="warning" title="Workflow needs attention" description={graphIssue} />
      ) : null}
      {error ? <Banner status="error" title="Run failed" description={error} /> : null}

      {selectedKind === 'files' ? (
        <FileInput
          label="Source image"
          value={selected?.file ?? null}
          onChange={selectFile}
          accept="image/jpeg,image/png"
          maxSize={MAX_INPUT_BYTES}
          mode="dropzone"
          isLoading={isInspecting}
          description="JPEG or PNG, up to 30 MB. The file stays on this device."
          placeholder="Drop an image or choose a file"
          status={
            selected
              ? {
                  type: 'success',
                  message: `${selected.info.width} × ${selected.info.height} ${selected.info.format.toUpperCase()}`,
                }
              : undefined
          }
          statusVariant="detached"
          width="100%"
        />
      ) : null}

      {selectedKind === 'inspect' ? (
        selected ? (
          <MetadataList columns="single" label={{ position: 'start', width: 128 }}>
            <MetadataListItem label="Format">{selected.info.format.toUpperCase()}</MetadataListItem>
            <MetadataListItem label="Dimensions">
              {selected.info.width} × {selected.info.height}
            </MetadataListItem>
            <MetadataListItem label="Source size">
              {formatBytes(selected.file.size)}
            </MetadataListItem>
            <MetadataListItem label="Decode estimate">
              {formatBytes(selected.info.estimatedDecodeBytes)}
            </MetadataListItem>
          </MetadataList>
        ) : (
          <Banner
            status="info"
            title="No source image"
            description="Choose an image in the Files node first."
          />
        )
      ) : null}

      {selectedKind === 'resize' ? (
        <VStack gap={4}>
          <NumberInput
            label="Maximum long edge"
            value={maxDimension}
            onChange={setMaxDimension}
            min={32}
            max={MAX_OUTPUT_DIMENSION}
            step={64}
            units="px"
            isIntegerOnly
            width="100%"
            isDisabled={runState === 'processing'}
            disabledMessage="Cancel the current run before changing resize settings."
          />
          {selected ? (
            <MetadataList columns="single" label={{ position: 'start', width: 128 }}>
              <MetadataListItem label="Peak estimate">
                {estimatedPeak ? formatBytes(estimatedPeak) : 'Above the safe limit'}
              </MetadataListItem>
            </MetadataList>
          ) : null}
        </VStack>
      ) : null}

      {selectedKind === 'webp' ? (
        <VStack gap={4}>
          <Slider
            label="WebP quality"
            value={quality}
            onChange={(value: number | [number, number]) => {
              if (typeof value === 'number') setQuality(value)
            }}
            min={1}
            max={100}
            step={1}
            formatValue={(value) => `${value}%`}
            valueDisplay="text"
            width="100%"
            isDisabled={runState === 'processing'}
            disabledMessage="Cancel the current run before changing quality."
          />
          {result?.warnings.length ? (
            <Banner status="warning" title="Output notes" description={result.warnings.join(' ')} />
          ) : null}
        </VStack>
      ) : null}

      {selectedKind === 'compare' && selected ? (
        <ImageComparison
          source={{
            label: 'Source',
            url: selected.previewUrl,
            width: selected.info.width,
            height: selected.info.height,
            size: selected.file.size,
          }}
          result={
            result && resultUrlRef.current
              ? {
                  label: 'WebP',
                  url: resultUrlRef.current,
                  width: result.width,
                  height: result.height,
                  size: result.size,
                }
              : null
          }
        />
      ) : null}

      {selectedKind === 'download' ? (
        <VStack gap={4}>
          {result ? (
            <MetadataList columns="single" label={{ position: 'start', width: 112 }}>
              <MetadataListItem label="Output">{formatBytes(result.size)}</MetadataListItem>
              <MetadataListItem label="Saved">
                {savings === null ? '—' : `${savings.toFixed(1)}%`}
              </MetadataListItem>
              <MetadataListItem label="Worker time">
                {Math.round(result.durationMs)} ms
              </MetadataListItem>
            </MetadataList>
          ) : null}
          <Button
            label={downloaded ? 'Download again' : 'Download WebP'}
            variant="primary"
            width="100%"
            isDisabled={!result}
            tooltip={!result ? 'Run the pipeline first.' : undefined}
            onClick={downloadResult}
          />
        </VStack>
      ) : null}

      {runState === 'processing' || runState === 'complete' ? (
        <ProgressBar
          label={progressLabel}
          value={progress}
          hasValueLabel
          variant={runState === 'complete' ? 'success' : 'accent'}
        />
      ) : null}

      {isNarrow ? (
        <VStack gap={3}>
          <Button
            label={
              runState === 'processing' ? 'Cancel run' : error ? 'Retry pipeline' : 'Run pipeline'
            }
            variant="primary"
            width="100%"
            onClick={runState === 'processing' ? cancelProcessing : processImage}
          />
          <ButtonGroup label="Edit workflow" size="sm">
            <Button
              label="Undo"
              variant="secondary"
              isDisabled={!pastRef.current.length}
              onClick={undo}
            />
            <Button
              label="Redo"
              variant="secondary"
              isDisabled={!futureRef.current.length}
              onClick={redo}
            />
            <Button
              label="Restore"
              variant="secondary"
              isDisabled={!missingKind}
              onClick={addMissingNode}
            />
            <Button label="Delete" variant="secondary" onClick={deleteSelected} />
          </ButtonGroup>
        </VStack>
      ) : null}
    </VStack>
  )

  const toolbar = (
    <Toolbar
      label="Workflow actions"
      size="sm"
      variant="muted"
      startContent={
        <HStack gap={2} vAlign="center">
          <Heading level={2}>Image pipeline</Heading>
          <Token label="Local" size="sm" color="green" />
        </HStack>
      }
      endContent={
        <HStack gap={2} vAlign="center">
          {!isNarrow ? (
            <>
              <ButtonGroup label="Edit history" size="sm">
                <Button
                  label="Undo"
                  variant="secondary"
                  isDisabled={!pastRef.current.length}
                  onClick={undo}
                />
                <Button
                  label="Redo"
                  variant="secondary"
                  isDisabled={!futureRef.current.length}
                  onClick={redo}
                />
              </ButtonGroup>
              <Button
                label={
                  missingKind
                    ? `Restore ${workflowDefinitions[missingKind].label}`
                    : 'All nodes present'
                }
                variant="secondary"
                isDisabled={!missingKind}
                onClick={addMissingNode}
              />
              <Button label="Delete" variant="secondary" onClick={deleteSelected} />
            </>
          ) : null}
          <Button
            label={runState === 'processing' ? 'Cancel' : error ? 'Retry' : 'Run pipeline'}
            variant="primary"
            onClick={runState === 'processing' ? cancelProcessing : processImage}
          />
        </HStack>
      }
    />
  )

  const canvas = (
    <ReactFlow<WorkflowCanvasNode, WorkflowCanvasEdge>
      className={isNarrow ? 'h-96' : 'h-full'}
      nodes={displayNodes}
      edges={displayEdges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onReconnect={onReconnect}
      isValidConnection={isValidConnection}
      onNodeDragStart={() => recordHistory()}
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

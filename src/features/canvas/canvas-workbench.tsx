import { AppShell } from '@astryxdesign/core/AppShell'
import { Button } from '@astryxdesign/core/Button'
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
  createCanvasEdge,
  createCanvasNode,
  createDisplayEdges,
  createDisplayNodes,
  createInitialCanvas,
  getCanvasConnectionIssue,
  getNodeStatus,
  outputFileName,
  selectCanvasNode,
  toEdgeModels,
  toNodeModels,
} from '#/features/canvas/canvas-model'
import { MobileWorkflowNavigator } from '#/features/canvas/mobile-workflow-navigator'
import type {
  GraphSnapshot,
  ProcessedImage,
  RunState,
  RuntimeEvent,
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
import { type InspectorView, WorkspaceInspector } from '#/features/canvas/workspace-inspector'
import { ImageLab, type TournamentViewResult } from '#/features/comparison/image-lab'
import { pickFolderImages } from '#/features/image-input/folder'
import { ImageValidationError, inspectImageHeader } from '#/features/image-input/validators'
import { canPersistWorkspace } from '#/features/privacy/policy'
import { usePrivacy } from '#/features/privacy/privacy-provider'
import { BatchPanel } from '#/features/processing/batch-panel'
import { runBatchQueue } from '#/features/processing/batch-runner'
import {
  DEFAULT_MAX_DIMENSION,
  DEFAULT_OUTPUT_FORMAT,
  DEFAULT_WEBP_QUALITY,
  MAX_CONSTRAINT_SEARCH_MS,
} from '#/features/processing/constants'
import {
  type ConstraintResult,
  solveQualityConstraint,
} from '#/features/processing/constraint-solver'
import { ImageProcessor, ProcessingError } from '#/features/processing/image-processor'
import { createOutputNames, getOutputDetails } from '#/features/processing/output'
import {
  createOutputArchive,
  type OutputFile,
  writeOutputsToFolder,
} from '#/features/processing/output-delivery'
import { createProcessingPlan } from '#/features/processing/processing-plan'
import { RuntimeDebugger } from '#/features/processing/runtime-debugger'
import type { BatchItem, OutputFormat } from '#/features/processing/types'
import type { WorkerProgress } from '#/features/processing/worker/protocol'
import { saveRun } from '#/features/recipes/local-store'
import { createRecipe } from '#/features/recipes/recipe'
import type { Recipe } from '#/features/recipes/types'
import { WorkspaceDialog } from '#/features/recipes/workspace-dialog'
import { createId } from '#/lib/create-id'

const HISTORY_LIMIT = 50
const INITIAL_PROGRESS = 4
const MAX_BATCH_FILES = 100
const WORKER_STAGE = {
  decode: { nodeIndex: 1, label: 'Decoding source image' },
  resize: { nodeIndex: 2, label: 'Resizing pixels' },
  encode: { nodeIndex: 3, label: 'Encoding output' },
} as const

const initialCanvas = createInitialCanvas()

interface History {
  past: GraphSnapshot[]
  future: GraphSnapshot[]
}

export function CanvasWorkbench() {
  const isNarrow = useMediaQuery('(max-width: 48rem)')
  const privacy = usePrivacy()
  const [processor] = useState(() => new ImageProcessor())
  const outputBlobsRef = useRef(new Map<string, Blob>())
  const tournamentBlobsRef = useRef(new Map<OutputFormat, Blob>())
  const tournamentUrlsRef = useRef(new Map<OutputFormat, string>())
  const sourceUrlRef = useRef<string | null>(null)
  const resultUrlRef = useRef<string | null>(null)
  const reconnectingEdgeIdRef = useRef<string | null>(null)
  const selectionIdRef = useRef(0)
  const runIdRef = useRef(0)

  const [nodes, setNodes] = useState<WorkflowCanvasNode[]>(initialCanvas.nodes)
  const [edges, setEdges] = useState<WorkflowCanvasEdge[]>(initialCanvas.edges)
  const [history, setHistory] = useState<History>({ past: [], future: [] })
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null)
  const [batchItems, setBatchItems] = useState<BatchItem[]>([])
  const [result, setResult] = useState<ProcessedImage | null>(null)
  const [maxDimension, setMaxDimension] = useState(DEFAULT_MAX_DIMENSION)
  const [quality, setQuality] = useState(DEFAULT_WEBP_QUALITY)
  const [outputFormat, setOutputFormat] = useState<OutputFormat>(DEFAULT_OUTPUT_FORMAT)
  const [renameTemplate, setRenameTemplate] = useState('{name}')
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
  const [inspectorView, setInspectorView] = useState<InspectorView>('node')
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false)
  const [deliveryMessage, setDeliveryMessage] = useState<string | null>(null)
  const [tournament, setTournament] = useState<TournamentViewResult[]>([])
  const [constraint, setConstraint] = useState<ConstraintResult | null>(null)
  const [constraintMaxKilobytes, setConstraintMaxKilobytes] = useState(200)
  const [runtimeEvents, setRuntimeEvents] = useState<RuntimeEvent[]>([])
  const [runHistoryVersion, setRunHistoryVersion] = useState(0)

  useEffect(() => {
    return () => {
      runIdRef.current += 1
      processor.dispose()
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
      for (const url of tournamentUrlsRef.current.values()) URL.revokeObjectURL(url)
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
    outputFormat,
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
      return createProcessingPlan(selectedImage.info, {
        format: outputFormat,
        maxDimension,
        quality,
      }).estimatedPeakBytes
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

  function selectNode(nodeId: string) {
    setNodes((current) => selectCanvasNode(current, nodeId))
    setEdges((current) => current.map((edge) => ({ ...edge, selected: false })))
    setInspectorView('node')
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
    outputBlobsRef.current.clear()
    setResult(null)
  }

  function releaseTournament() {
    for (const url of tournamentUrlsRef.current.values()) URL.revokeObjectURL(url)
    tournamentUrlsRef.current.clear()
    tournamentBlobsRef.current.clear()
    setTournament([])
    setConstraint(null)
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
    setBatchItems((current) =>
      current.map((item) => ({ ...item, output: undefined, progress: 0, status: 'ready' })),
    )
    releaseTournament()
  }

  function changeMaxDimension(value: number) {
    setMaxDimension(value)
    invalidateResult()
  }

  function changeQuality(value: number) {
    setQuality(value)
    invalidateResult()
  }

  function changeOutputFormat(value: OutputFormat) {
    setOutputFormat(value)
    invalidateResult()
  }

  function changeRenameTemplate(value: string) {
    setRenameTemplate(value)
    const names = createOutputNames(
      batchItems.map(({ relativePath }) => relativePath),
      outputFormat,
      value,
    )
    setBatchItems((current) =>
      current.map((item, index) =>
        item.output
          ? {
              ...item,
              output: { ...item.output, outputName: names[index] ?? item.output.outputName },
            }
          : item,
      ),
    )
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

  async function inspectFiles(files: Array<{ file: File; relativePath: string }>) {
    const selectionId = ++selectionIdRef.current
    runIdRef.current += 1
    processor.cancel()
    resetRunState()
    releaseTournament()

    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
    sourceUrlRef.current = null
    setSelectedImage(null)
    setBatchItems([])
    setDeliveryMessage(null)
    if (!files.length) return

    setIsInspecting(true)
    const valid: BatchItem[] = []
    const rejected: string[] = []
    try {
      for (const { file, relativePath } of files.slice(0, MAX_BATCH_FILES)) {
        try {
          const info = inspectImageHeader(await file.arrayBuffer(), file.type)
          if (selectionId !== selectionIdRef.current) return
          valid.push({
            id: createId(),
            file,
            info,
            progress: 0,
            relativePath,
            status: 'ready',
          })
        } catch (reason) {
          const message =
            reason instanceof ImageValidationError
              ? reason.message
              : 'The image could not be inspected.'
          rejected.push(`${relativePath}: ${message}`)
        }
      }

      setBatchItems(valid)
      const first = valid[0]
      if (first) {
        const previewUrl = URL.createObjectURL(first.file)
        sourceUrlRef.current = previewUrl
        setSelectedImage({ file: first.file, info: first.info, previewUrl })
        setProgressLabel(
          `${valid.length} image${valid.length === 1 ? '' : 's'} inspected and ready`,
        )
      }
      if (rejected.length) {
        setGraphIssue(
          `${rejected.length} file${rejected.length === 1 ? '' : 's'} skipped. ${rejected[0]}`,
        )
      }
      if (!valid.length) {
        setError(rejected[0] ?? 'Choose valid JPEG or PNG images.')
        setFailedNodeId(nodes.find((node) => node.data.kind === 'inspect')?.id ?? null)
      }
    } finally {
      if (selectionId === selectionIdRef.current) setIsInspecting(false)
    }
  }

  function selectFile(value: File | File[] | null) {
    const files = value ? (Array.isArray(value) ? value : [value]) : []
    return inspectFiles(
      files.map((file) => ({ file, relativePath: file.webkitRelativePath || file.name })),
    )
  }

  async function selectFolder() {
    try {
      await inspectFiles(await pickFolderImages())
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      setError(reason instanceof Error ? reason.message : 'The folder could not be opened.')
    }
  }

  function updateWorkerProgress(
    update: WorkerProgress,
    sequence: string[],
    setFailureNode: (nodeId: string) => void,
    itemId: string,
    itemIndex: number,
    itemCount: number,
    startedAt: number,
  ) {
    const stage = WORKER_STAGE[update.stage]
    const nodeId = sequence[stage.nodeIndex]
    if (!nodeId) return

    setFailureNode(nodeId)
    setActiveNodeId(nodeId)
    setProgress(Math.round(((itemIndex + update.progress / 100) / itemCount) * 100))
    setProgressLabel(`${stage.label} · ${itemIndex + 1} of ${itemCount}`)
    setBatchItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, progress: update.progress, status: 'processing' } : item,
      ),
    )
    setRuntimeEvents((current) => [
      ...current,
      {
        elapsedMs: performance.now() - startedAt,
        id: createId(),
        label: stage.label,
        progress: update.progress,
        stage: update.stage,
      },
    ])
  }

  async function processBatch(targetIds?: Set<string>) {
    if (!selectedImage || !batchItems.length) {
      setGraphIssue('Select the Files node and choose JPEG or PNG images before running.')
      return
    }

    let sequence: string[]
    try {
      sequence = compileWorkflow(toNodeModels(nodes), toEdgeModels(edges))
      for (const item of batchItems) {
        createProcessingPlan(item.info, { format: outputFormat, maxDimension, quality })
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'The workflow is not ready to run.'
      if (reason instanceof WorkflowGraphError) setGraphIssue(message)
      else setError(message)
      return
    }

    const queueItems = targetIds ? batchItems.filter(({ id }) => targetIds.has(id)) : batchItems
    if (!queueItems.length) return

    const runId = ++runIdRef.current
    let failureNodeId = sequence[1]
    const startedAt = performance.now()
    const outputNames = createOutputNames(
      batchItems.map(({ relativePath }) => relativePath),
      outputFormat,
      renameTemplate,
    )
    const outputNameById = new Map(
      batchItems.map((item, index) => [
        item.id,
        outputNames[index] ?? `${item.id}.${outputFormat}`,
      ]),
    )
    setGraphIssue(null)
    setError(null)
    if (!targetIds) {
      releaseResult()
      setBatchItems((current) =>
        current.map((item) => ({
          ...item,
          error: undefined,
          output: undefined,
          progress: 0,
          status: 'ready',
        })),
      )
    }
    setRunState('processing')
    setProgress(INITIAL_PROGRESS)
    setActiveNodeId(sequence[1])
    setFailedNodeId(null)
    setCancelledNodeId(null)
    setDownloaded(false)
    setProgressLabel(`Preparing ${queueItems.length} image${queueItems.length === 1 ? '' : 's'}`)
    setRuntimeEvents([])

    const results = await runBatchQueue(
      queueItems.map((item) => ({ id: item.id, value: item })),
      async (item) => {
        const itemIndex = queueItems.findIndex(({ id }) => id === item.id)
        setBatchItems((current) =>
          current.map((currentItem) =>
            currentItem.id === item.id
              ? { ...currentItem, error: undefined, progress: 0, status: 'processing' }
              : currentItem,
          ),
        )
        const buffer = await item.file.arrayBuffer()
        if (runId !== runIdRef.current) throw new ProcessingError('cancelled', 'Cancelled.')

        const workerResult = await processor.process(
          buffer,
          item.info.mimeType,
          { format: outputFormat, maxDimension, quality },
          (update) => {
            if (runId !== runIdRef.current) return
            updateWorkerProgress(
              update,
              sequence,
              (nodeId) => {
                failureNodeId = nodeId
              },
              item.id,
              itemIndex,
              queueItems.length,
              startedAt,
            )
          },
        )
        const blob = new Blob([workerResult.output], { type: workerResult.mimeType })
        outputBlobsRef.current.set(item.id, blob)
        const processed: ProcessedImage = {
          durationMs: workerResult.durationMs,
          format: outputFormat,
          height: workerResult.height,
          mimeType: workerResult.mimeType,
          outputName: outputNameById.get(item.id) as string,
          size: blob.size,
          warnings: workerResult.warnings,
          width: workerResult.width,
        }

        if (item.id === batchItems[0]?.id) {
          if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
          resultUrlRef.current = URL.createObjectURL(blob)
          setResult(processed)
        }
        return processed
      },
      (itemResult) => {
        setBatchItems((current) =>
          current.map((item) =>
            item.id === itemResult.id
              ? itemResult.result
                ? { ...item, output: itemResult.result, progress: 100, status: 'complete' }
                : { ...item, error: itemResult.error, progress: 0, status: 'failed' }
              : item,
          ),
        )
      },
      () => runId !== runIdRef.current,
    )
    if (runId !== runIdRef.current) return

    const completed = results.flatMap(({ result }) => (result ? [result] : []))
    const failed = results.length - completed.length
    setProgress(completed.length ? 100 : 0)
    setProgressLabel(
      failed
        ? `${completed.length} completed · ${failed} failed`
        : `${completed.length} output${completed.length === 1 ? '' : 's'} ready`,
    )
    setRunState(completed.length ? 'complete' : 'idle')
    setActiveNodeId(null)
    if (failed) setFailedNodeId(failureNodeId)
    if (!completed.length) setError('No images completed. Review the failed files in Batch.')

    if (completed.length) {
      const downloadNodeId = sequence.at(-1)
      if (downloadNodeId) selectNode(downloadNodeId)
    }
    if (canPersistWorkspace(privacy)) {
      await saveRun({
        id: createId(),
        completed: completed.length,
        durationMs: performance.now() - startedAt,
        failed,
        format: outputFormat,
        sourceCount: results.length,
        totalOutputBytes: completed.reduce((total, output) => total + output.size, 0),
        updatedAt: new Date().toISOString(),
      }).catch(() => {})
      setRunHistoryVersion((current) => current + 1)
    }
  }

  function processImage() {
    return processBatch()
  }

  function retryFailed() {
    return processBatch(
      new Set(batchItems.filter(({ status }) => status === 'failed').map(({ id }) => id)),
    )
  }

  function cancelProcessing() {
    runIdRef.current += 1
    processor.cancel()
    setCancelledNodeId(activeNodeId)
    setActiveNodeId(null)
    setRunState('cancelled')
    setProgress(0)
    setProgressLabel('Processing cancelled')
    setBatchItems((current) =>
      current.map((item) =>
        item.status === 'processing' || item.status === 'ready'
          ? { ...item, progress: 0, status: 'cancelled' }
          : item,
      ),
    )
  }

  function downloadResult() {
    const first = batchItems[0]
    const blob = first ? outputBlobsRef.current.get(first.id) : undefined
    if (!blob || !first?.output) return

    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download =
      first.output.outputName.split('/').at(-1) ?? outputFileName(first.file.name, outputFormat)
    link.click()
    setDownloaded(true)
    setTimeout(() => URL.revokeObjectURL(link.href), 0)
  }

  function outputFiles(): OutputFile[] {
    return batchItems.flatMap((item) => {
      const blob = outputBlobsRef.current.get(item.id)
      return blob && item.output ? [{ blob, name: item.output.outputName }] : []
    })
  }

  async function downloadArchive() {
    const outputs = outputFiles()
    if (!outputs.length) return
    try {
      const archive = await createOutputArchive(outputs)
      const link = document.createElement('a')
      link.href = URL.createObjectURL(archive)
      link.download = 'hexlode-outputs.zip'
      link.click()
      setTimeout(() => URL.revokeObjectURL(link.href), 0)
      setDeliveryMessage(`${outputs.length} outputs packaged as a streaming ZIP.`)
    } catch (reason) {
      setDeliveryMessage(reason instanceof Error ? reason.message : 'The ZIP could not be created.')
    }
  }

  async function saveOutputFolder() {
    const outputs = outputFiles()
    if (!outputs.length) return
    try {
      await writeOutputsToFolder(outputs)
      setDeliveryMessage(`${outputs.length} outputs saved with their relative folder hierarchy.`)
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      setDeliveryMessage(
        reason instanceof Error ? reason.message : 'The outputs could not be saved.',
      )
    }
  }

  async function runTournament() {
    if (!selectedImage || runState === 'processing') return

    try {
      createProcessingPlan(selectedImage.info, {
        format: 'webp',
        maxDimension,
        quality,
      })
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'The codec comparison is not safe to run.',
      )
      return
    }

    const runId = ++runIdRef.current
    releaseTournament()
    setInspectorView('lab')
    setRunState('processing')
    setError(null)
    setProgress(0)
    setProgressLabel('Starting codec tournament')

    const results: TournamentViewResult[] = []
    for (const [index, format] of (['webp', 'jpeg', 'png'] as const).entries()) {
      try {
        const workerResult = await processor.process(
          await selectedImage.file.arrayBuffer(),
          selectedImage.info.mimeType,
          { format, maxDimension, quality },
          (update) => {
            if (runId !== runIdRef.current) return
            setProgress(Math.round(((index + update.progress / 100) / 3) * 100))
            setProgressLabel(`Testing ${getOutputDetails(format).label} · ${update.progress}%`)
          },
        )
        if (runId !== runIdRef.current) return

        const blob = new Blob([workerResult.output], { type: workerResult.mimeType })
        const previewUrl = URL.createObjectURL(blob)
        tournamentBlobsRef.current.set(format, blob)
        tournamentUrlsRef.current.set(format, previewUrl)
        const entry: TournamentViewResult = {
          compatibility: format === 'webp' ? 'modern browsers' : 'broad compatibility',
          durationMs: workerResult.durationMs,
          format,
          height: workerResult.height,
          mimeType: workerResult.mimeType,
          outputName: createOutputNames(
            [selectedImage.file.name],
            format,
            renameTemplate,
          )[0] as string,
          previewUrl,
          size: blob.size,
          transparency: format === 'jpeg' ? 'flattened' : 'preserved',
          warnings: workerResult.warnings,
          width: workerResult.width,
        }
        results.push(entry)
        setTournament([...results])
      } catch (reason) {
        if (runId !== runIdRef.current) return
        if (!(reason instanceof ProcessingError && reason.code === 'cancelled')) {
          setError(reason instanceof Error ? reason.message : 'A codec comparison failed.')
        }
      }
    }

    if (runId !== runIdRef.current) return
    setRunState(results.length ? 'complete' : 'idle')
    setProgress(results.length ? 100 : 0)
    setProgressLabel(`${results.length} codec${results.length === 1 ? '' : 's'} measured`)
  }

  function useTournamentResult(format: OutputFormat) {
    const entry = tournament.find((result) => result.format === format)
    const blob = tournamentBlobsRef.current.get(format)
    const first = batchItems[0]
    if (!entry || !blob || !first) return

    const processed: ProcessedImage = {
      ...entry,
      outputName: createOutputNames([first.relativePath], format, renameTemplate)[0] as string,
    }
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    resultUrlRef.current = URL.createObjectURL(blob)
    outputBlobsRef.current.set(first.id, blob)
    setOutputFormat(format)
    setResult(processed)
    setBatchItems((current) =>
      current.map((item) =>
        item.id === first.id
          ? { ...item, output: processed, progress: 100, status: 'complete' }
          : item,
      ),
    )
    setProgressLabel(`${getOutputDetails(format).label} tournament result selected`)
    setRunState('complete')
  }

  async function runConstraintSolver() {
    if (!selectedImage || runState === 'processing') return

    try {
      createProcessingPlan(selectedImage.info, {
        format: 'webp',
        maxDimension,
        quality,
      })
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'The constraint search is not safe to run.',
      )
      return
    }

    const runId = ++runIdRef.current
    const maxBytes = constraintMaxKilobytes * 1024
    let bestCandidate: { blob: Blob; result: ProcessedImage } | null = null
    let timedOut = false
    const timeoutId = window.setTimeout(() => {
      timedOut = true
      processor.cancel()
    }, MAX_CONSTRAINT_SEARCH_MS)
    setConstraint(null)
    setInspectorView('lab')
    setRunState('processing')
    setError(null)
    setProgress(0)
    setProgressLabel('Searching WebP quality')

    try {
      const solved = await solveQualityConstraint(
        maxBytes,
        async (candidateQuality) => {
          const workerResult = await processor.process(
            await selectedImage.file.arrayBuffer(),
            selectedImage.info.mimeType,
            { format: 'webp', maxDimension, quality: candidateQuality },
            (update) => {
              if (runId !== runIdRef.current) return
              setProgress(update.progress)
              setProgressLabel(`Testing WebP quality ${candidateQuality}`)
            },
          )
          const blob = new Blob([workerResult.output], { type: workerResult.mimeType })
          if (blob.size <= maxBytes) {
            bestCandidate = {
              blob,
              result: {
                durationMs: workerResult.durationMs,
                format: 'webp',
                height: workerResult.height,
                mimeType: workerResult.mimeType,
                outputName: createOutputNames(
                  [selectedImage.file.name],
                  'webp',
                  renameTemplate,
                )[0] as string,
                size: blob.size,
                warnings: workerResult.warnings,
                width: workerResult.width,
              },
            }
          }
          return blob.size
        },
        () => runId !== runIdRef.current,
      )
      if (runId !== runIdRef.current) return

      setConstraint(solved)
      if (solved.best && bestCandidate) {
        const candidate = bestCandidate as { blob: Blob; result: ProcessedImage }
        const first = batchItems[0]
        if (first) {
          if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
          resultUrlRef.current = URL.createObjectURL(candidate.blob)
          outputBlobsRef.current.set(first.id, candidate.blob)
          setBatchItems((current) =>
            current.map((item) =>
              item.id === first.id
                ? { ...item, output: candidate.result, progress: 100, status: 'complete' }
                : item,
            ),
          )
        }
        setOutputFormat('webp')
        setQuality(solved.best.quality)
        setResult(candidate.result)
        setProgress(100)
        setProgressLabel(`Quality ${solved.best.quality} meets the size limit`)
        setRunState('complete')
      } else {
        setProgress(0)
        setProgressLabel('No WebP output met the size limit')
        setRunState('idle')
      }
    } catch (reason) {
      if (runId !== runIdRef.current) return
      setRunState('idle')
      setError(
        timedOut
          ? 'The constraint search exceeded its 30-second limit.'
          : reason instanceof Error
            ? reason.message
            : 'The constraint search failed.',
      )
    } finally {
      window.clearTimeout(timeoutId)
    }
  }

  function currentRecipe(name: string, kind: Recipe['kind']) {
    return createRecipe({
      edges,
      kind,
      name,
      nodes,
      options: { format: outputFormat, maxDimension, quality },
      renameTemplate,
    })
  }

  function applyRecipe(recipe: Recipe) {
    recordHistory()
    setNodes(
      recipe.graph.nodes.map((node, index) =>
        createCanvasNode(
          {
            id: node.id,
            data: { kind: node.kind },
            position: recipe.layout.positions[node.id] ?? createNodePosition(index),
          },
          index === 0,
        ),
      ),
    )
    setEdges(recipe.graph.edges.map(createCanvasEdge))
    setMaxDimension(recipe.execution.maxDimension)
    setQuality(recipe.execution.quality)
    setOutputFormat(recipe.execution.format)
    setRenameTemplate(recipe.execution.renameTemplate)
    invalidateResult()
    setGraphIssue(`${recipe.name} applied.`)
    setIsWorkspaceOpen(false)
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
    selectFolder,
    setMaxDimension: changeMaxDimension,
    setOutputFormat: changeOutputFormat,
    setQuality: changeQuality,
    undo,
  }
  const nodeInspector = (
    <WorkflowInspector
      actions={actions}
      canRedo={history.future.length > 0}
      canUndo={history.past.length > 0}
      currentStatus={currentStatus}
      isNarrow={isNarrow}
      missingKind={missingKind}
      state={{
        batchItems,
        downloaded,
        error,
        estimatedPeakBytes,
        graphIssue,
        isInspecting,
        maxDimension,
        outputFormat,
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
  const inspector = (
    <WorkspaceInspector
      batchCount={batchItems.length}
      value={inspectorView}
      onChange={setInspectorView}
    >
      {{
        node: nodeInspector,
        batch: (
          <BatchPanel
            deliveryMessage={deliveryMessage}
            isProcessing={runState === 'processing'}
            items={batchItems}
            renameTemplate={renameTemplate}
            setRenameTemplate={changeRenameTemplate}
            onDownloadArchive={downloadArchive}
            onRetryFailed={retryFailed}
            onWriteFolder={saveOutputFolder}
          />
        ),
        lab: (
          <ImageLab
            constraint={constraint}
            constraintMaxKilobytes={constraintMaxKilobytes}
            isBusy={runState === 'processing'}
            result={result}
            resultUrl={resultUrlRef.current}
            selectedImage={selectedImage}
            setConstraintMaxKilobytes={setConstraintMaxKilobytes}
            tournament={tournament}
            onRunConstraint={runConstraintSolver}
            onRunTournament={runTournament}
            onUseTournamentResult={useTournamentResult}
          />
        ),
        debug: <RuntimeDebugger events={runtimeEvents} refreshKey={runHistoryVersion} />,
      }}
    </WorkspaceInspector>
  )
  const toolbar = (
    <WorkflowToolbar
      canRedo={history.future.length > 0}
      canUndo={history.past.length > 0}
      error={error}
      isNarrow={isNarrow}
      isProcessing={runState === 'processing'}
      isComplete={runState === 'complete'}
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
            <HStack gap={2} vAlign="center">
              <Button
                label="Workspace"
                variant="secondary"
                size="sm"
                onClick={() => setIsWorkspaceOpen(true)}
              />
              <HStack gap={1} vAlign="center">
                <StatusDot
                  variant={privacy.mode === 'private' || privacy.airgap ? 'warning' : 'success'}
                  label="Processing stays on this device"
                />
                <Text type="supporting">
                  {privacy.mode === 'private' ? 'Private' : privacy.airgap ? 'Airgap' : 'Local'}
                </Text>
              </HStack>
            </HStack>
          }
        />
      }
    >
      <WorkspaceDialog
        createCurrentRecipe={currentRecipe}
        isOpen={isWorkspaceOpen}
        onApplyRecipe={applyRecipe}
        onOpenChange={setIsWorkspaceOpen}
      />
      {isNarrow ? (
        <VStack gap={0}>
          {toolbar}
          <Section variant="section" padding={4} dividers={['bottom']}>
            <MobileWorkflowNavigator nodes={displayNodes} onSelect={selectNode} />
          </Section>
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

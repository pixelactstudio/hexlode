import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { ButtonGroup } from '@astryxdesign/core/ButtonGroup'
import { FileInput } from '@astryxdesign/core/FileInput'
import { Heading } from '@astryxdesign/core/Heading'
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList'
import { NumberInput } from '@astryxdesign/core/NumberInput'
import { ProgressBar } from '@astryxdesign/core/ProgressBar'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { Slider } from '@astryxdesign/core/Slider'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'

import type {
  ProcessedImage,
  RunState,
  SelectedImage,
  WorkflowCanvasNode,
} from '#/features/canvas/types'
import { WORKFLOW_DEFINITIONS, WORKFLOW_KINDS } from '#/features/canvas/workflow/constants'
import type { WorkflowKind, WorkflowStatus } from '#/features/canvas/workflow/types'
import { ImageComparison } from '#/features/comparison/image-comparison'
import { MAX_INPUT_BYTES, MAX_INPUT_MEGABYTES } from '#/features/image-input/constants'
import { MAX_OUTPUT_DIMENSION, MIN_OUTPUT_DIMENSION } from '#/features/processing/constants'
import { getOutputDetails } from '#/features/processing/output'
import type { BatchItem, OutputFormat } from '#/features/processing/types'
import { formatBytes } from '#/lib/format-bytes'

interface InspectorState {
  batchItems: BatchItem[]
  downloaded: boolean
  error: string | null
  estimatedPeakBytes: number | null
  graphIssue: string | null
  isInspecting: boolean
  maxDimension: number
  outputFormat: OutputFormat
  progress: number
  progressLabel: string
  quality: number
  result: ProcessedImage | null
  resultUrl: string | null
  runState: RunState
  savings: number | null
  selectedImage: SelectedImage | null
  selectedNode: WorkflowCanvasNode | null
}

interface InspectorActions {
  addMissingNode: () => void
  cancelProcessing: () => void
  deleteSelected: () => void
  downloadResult: () => void
  processImage: () => void
  redo: () => void
  selectFile: (value: File | File[] | null) => void
  selectFolder: () => void
  setMaxDimension: (value: number) => void
  setOutputFormat: (value: OutputFormat) => void
  setQuality: (value: number) => void
  undo: () => void
}

interface WorkflowInspectorProps {
  actions: InspectorActions
  canRedo: boolean
  canUndo: boolean
  currentStatus: WorkflowStatus
  isNarrow: boolean
  missingKind: WorkflowKind | undefined
  state: InspectorState
}

interface NodePanelProps {
  actions: InspectorActions
  state: InspectorState
}

function InspectorHeader({
  node,
  status,
}: {
  node: WorkflowCanvasNode | null
  status: WorkflowStatus
}) {
  if (!node) {
    return (
      <VStack gap={1}>
        <Heading level={2}>Inspector</Heading>
        <Text color="secondary">Select a node to edit its settings.</Text>
      </VStack>
    )
  }

  const definition = WORKFLOW_DEFINITIONS[node.data.kind]
  const nodeNumber = String(WORKFLOW_KINDS.indexOf(node.data.kind) + 1).padStart(2, '0')

  return (
    <VStack gap={1}>
      <HStack gap={2} hAlign="between" vAlign="center">
        <Text type="code" color="secondary">
          NODE {nodeNumber}
        </Text>
        <Token label={status} size="sm" color={status === 'failed' ? 'red' : 'gray'} />
      </HStack>
      <Heading level={2}>{definition.label}</Heading>
      <Text color="secondary">{definition.description}</Text>
    </VStack>
  )
}

function FileNodePanel({ actions, state }: NodePanelProps) {
  const { batchItems, isInspecting, selectedImage } = state
  const statusMessage = selectedImage
    ? `${selectedImage.info.width} × ${selectedImage.info.height} ${selectedImage.info.format.toUpperCase()}`
    : undefined

  return (
    <VStack gap={3}>
      <FileInput
        label="Source images"
        value={batchItems.map(({ file }) => file)}
        onChange={actions.selectFile}
        accept="image/jpeg,image/png"
        isMultiple
        maxFiles={100}
        maxSize={MAX_INPUT_BYTES}
        mode="dropzone"
        isLoading={isInspecting}
        description={`Up to 100 JPEG or PNG files, ${MAX_INPUT_MEGABYTES} MB each. Files stay on this device.`}
        placeholder="Drop images or choose files"
        status={statusMessage ? { type: 'success', message: statusMessage } : undefined}
        statusVariant="detached"
        width="100%"
      />
      <Button
        label="Choose folder"
        variant="secondary"
        width="100%"
        isDisabled={isInspecting}
        onClick={actions.selectFolder}
      />
    </VStack>
  )
}

function InspectNodePanel({ state }: NodePanelProps) {
  const { selectedImage } = state
  if (!selectedImage) {
    return (
      <Banner
        status="info"
        title="No source image"
        description="Choose an image in the Files node first."
      />
    )
  }

  const dimensions = `${selectedImage.info.width} × ${selectedImage.info.height}`
  const sourceSize = formatBytes(selectedImage.file.size)
  const decodeEstimate = formatBytes(selectedImage.info.estimatedDecodeBytes)

  return (
    <MetadataList columns="single" label={{ position: 'start', width: 128 }}>
      <MetadataListItem label="Format">{selectedImage.info.format.toUpperCase()}</MetadataListItem>
      <MetadataListItem label="Dimensions">{dimensions}</MetadataListItem>
      <MetadataListItem label="Source size">{sourceSize}</MetadataListItem>
      <MetadataListItem label="Decode estimate">{decodeEstimate}</MetadataListItem>
    </MetadataList>
  )
}

function ResizeNodePanel({ actions, state }: NodePanelProps) {
  const peakEstimate = state.estimatedPeakBytes
    ? formatBytes(state.estimatedPeakBytes)
    : 'Above the safe limit'

  return (
    <VStack gap={4}>
      <NumberInput
        label="Maximum long edge"
        value={state.maxDimension}
        onChange={actions.setMaxDimension}
        min={MIN_OUTPUT_DIMENSION}
        max={MAX_OUTPUT_DIMENSION}
        step={64}
        units="px"
        isIntegerOnly
        width="100%"
        isDisabled={state.runState === 'processing'}
        disabledMessage="Cancel the current run before changing resize settings."
      />
      {state.selectedImage ? (
        <MetadataList columns="single" label={{ position: 'start', width: 128 }}>
          <MetadataListItem label="Peak estimate">{peakEstimate}</MetadataListItem>
        </MetadataList>
      ) : null}
    </VStack>
  )
}

function EncodeNodePanel({ actions, state }: NodePanelProps) {
  const outputNotes = state.result?.warnings.join(' ')

  return (
    <VStack gap={4}>
      <SegmentedControl
        label="Output format"
        value={state.outputFormat}
        onChange={(value) => actions.setOutputFormat(value as OutputFormat)}
        layout="fill"
        isDisabled={state.runState === 'processing'}
      >
        <SegmentedControlItem value="webp" label="WebP" />
        <SegmentedControlItem value="jpeg" label="JPEG" />
        <SegmentedControlItem value="png" label="PNG" />
      </SegmentedControl>
      <Slider
        label={`${getOutputDetails(state.outputFormat).label} quality`}
        value={state.quality}
        onChange={(value: number | [number, number]) => {
          if (typeof value === 'number') actions.setQuality(value)
        }}
        min={1}
        max={100}
        step={1}
        formatValue={(value) => `${value}%`}
        valueDisplay="text"
        width="100%"
        isDisabled={state.runState === 'processing'}
        disabledMessage="Cancel the current run before changing quality."
      />
      {outputNotes ? (
        <Banner status="warning" title="Output notes" description={outputNotes} />
      ) : null}
    </VStack>
  )
}

function CompareNodePanel({ state }: NodePanelProps) {
  const { result, resultUrl, selectedImage } = state
  if (!selectedImage) return null

  return (
    <ImageComparison
      source={{
        label: 'Source',
        url: selectedImage.previewUrl,
        width: selectedImage.info.width,
        height: selectedImage.info.height,
        size: selectedImage.file.size,
      }}
      result={
        result && resultUrl
          ? {
              label: getOutputDetails(result.format).label,
              url: resultUrl,
              width: result.width,
              height: result.height,
              size: result.size,
            }
          : null
      }
    />
  )
}

function DownloadNodePanel({ actions, state }: NodePanelProps) {
  const { downloaded, result, savings } = state
  const saved = savings === null ? '—' : `${savings.toFixed(1)}%`
  const workerTime = result ? `${Math.round(result.durationMs)} ms` : null

  return (
    <VStack gap={4}>
      {result ? (
        <MetadataList columns="single" label={{ position: 'start', width: 112 }}>
          <MetadataListItem label="Output">{formatBytes(result.size)}</MetadataListItem>
          <MetadataListItem label="Saved">{saved}</MetadataListItem>
          <MetadataListItem label="Worker time">{workerTime}</MetadataListItem>
        </MetadataList>
      ) : null}
      <Button
        label={
          downloaded ? 'Download again' : `Download ${getOutputDetails(state.outputFormat).label}`
        }
        variant="primary"
        width="100%"
        isDisabled={!result}
        tooltip={!result ? 'Run the pipeline first.' : undefined}
        onClick={actions.downloadResult}
      />
    </VStack>
  )
}

function NodePanel({ kind, ...props }: NodePanelProps & { kind: WorkflowKind | null }) {
  switch (kind) {
    case 'files':
      return <FileNodePanel {...props} />
    case 'inspect':
      return <InspectNodePanel {...props} />
    case 'resize':
      return <ResizeNodePanel {...props} />
    case 'encode':
      return <EncodeNodePanel {...props} />
    case 'compare':
      return <CompareNodePanel {...props} />
    case 'download':
      return <DownloadNodePanel {...props} />
    default:
      return null
  }
}

function MobileActions({
  actions,
  canRedo,
  canUndo,
  missingKind,
}: Pick<WorkflowInspectorProps, 'actions' | 'canRedo' | 'canUndo' | 'missingKind'>) {
  return (
    <ButtonGroup label="Edit workflow" size="sm">
      <Button label="Undo" variant="secondary" isDisabled={!canUndo} onClick={actions.undo} />
      <Button label="Redo" variant="secondary" isDisabled={!canRedo} onClick={actions.redo} />
      <Button
        label="Restore"
        variant="secondary"
        isDisabled={!missingKind}
        onClick={actions.addMissingNode}
      />
      <Button label="Delete" variant="secondary" onClick={actions.deleteSelected} />
    </ButtonGroup>
  )
}

export function WorkflowInspector({
  actions,
  canRedo,
  canUndo,
  currentStatus,
  isNarrow,
  missingKind,
  state,
}: WorkflowInspectorProps) {
  const selectedKind = state.selectedNode?.data.kind ?? null
  const showProgress = state.runState === 'processing' || state.runState === 'complete'

  return (
    <VStack gap={5}>
      <InspectorHeader node={state.selectedNode} status={currentStatus} />
      {state.graphIssue ? (
        <Banner status="warning" title="Workflow needs attention" description={state.graphIssue} />
      ) : null}
      {state.error ? <Banner status="error" title="Run failed" description={state.error} /> : null}
      <NodePanel kind={selectedKind} actions={actions} state={state} />
      {showProgress ? (
        <ProgressBar
          label={state.progressLabel}
          value={state.progress}
          hasValueLabel
          variant={state.runState === 'complete' ? 'success' : 'accent'}
        />
      ) : null}
      {isNarrow ? (
        <MobileActions
          actions={actions}
          canRedo={canRedo}
          canUndo={canUndo}
          missingKind={missingKind}
        />
      ) : null}
    </VStack>
  )
}

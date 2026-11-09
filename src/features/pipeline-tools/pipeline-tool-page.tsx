import { Button } from '@astryxdesign/core/Button'
import { Divider } from '@astryxdesign/core/Divider'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState, useSyncExternalStore } from 'react'

import { PageColumn } from '#/features/app-shell/page-column'
import type { Pipeline } from '#/features/engine/types'
import { useArrivingFiles } from '#/features/handover/use-arriving-files'
import { productRegistry } from '#/features/nodes/registry'
import { useSharePipeline } from '#/features/pipeline-tools/use-share-pipeline'
import { validatePipeline } from '#/features/pipelines/pipeline-file'
import { pipelineStore } from '#/features/pipelines/storage'
import { ToolColumns, ToolPageFrame } from '#/features/quick-tools/quick-tool-page'
import { createRunController, type Surface } from '#/features/runs/run-controller'
import { FilesSection, ResultsSection, RunSection, ToolPanel } from '#/features/runs/run-panel'
import { useController, useRunState } from '#/features/runs/use-run-controller'
import { NodeSettings } from '#/features/studio/node-settings'
import { PipelineSteps } from '#/features/studio/pipeline-steps'
import { usePageView } from '#/features/usage/use-page-view'

function outputsOf(pipeline: Pipeline) {
  return pipeline.nodes.filter((node) => node.type === 'output')
}

/** Merges settings changes into one node, keeping the pipeline valid. */
function withSettings(pipeline: Pipeline, nodeId: string, changes: Record<string, unknown>) {
  return {
    ...pipeline,
    nodes: pipeline.nodes.map((node) => {
      if (node.id !== nodeId) return node
      const merged = { ...node.settings, ...changes }
      try {
        productRegistry.get(node.type)?.parseSettings(merged)
      } catch {
        return node
      }
      return { ...node, settings: merged }
    }),
  }
}

/** The settings of the nodes a tool lets people change, one form per node. */
function AdjustableSettings({
  pipeline,
  nodeIds,
  onChange,
  isDisabled,
}: {
  pipeline: Pipeline
  nodeIds: readonly string[]
  onChange: (nodeId: string, changes: Record<string, unknown>) => void
  isDisabled: boolean
}) {
  return nodeIds.map((nodeId) => {
    const node = pipeline.nodes.find((candidate) => candidate.id === nodeId)
    const definition = node && productRegistry.get(node.type)
    if (!node || !definition) return null
    return (
      <VStack key={nodeId} gap={4}>
        <Divider />
        <Text type="label" weight="semibold">
          {definition.label}
        </Text>
        <NodeSettings
          definition={definition}
          settings={definition.parseSettings(node.settings)}
          onChange={(changes) => onChange(nodeId, changes)}
          isDisabled={isDisabled}
        />
      </VStack>
    )
  })
}

/**
 * The body of every pipeline tool page: images on the left, the pipeline's steps, any settings the
 * tool lets people change and the run button on the right, the results below.
 */
export function PipelineToolBody({
  path,
  pipeline,
  surface = 'pipeline-tool',
  builtInTool,
  adjustable = [],
  countRun,
  problem,
  onPipelineChange,
}: {
  /** The page's own address, such as `/tools/<id>`, for files handed over from the open page. */
  path: string
  pipeline: Pipeline
  surface?: Exclude<Surface, 'studio' | 'quick-tool'>
  builtInTool?: string
  /** Ids of the nodes whose settings the page shows. */
  adjustable?: readonly string[]
  countRun?: () => number | undefined
  /** What still has to be set before the pipeline can run, or null when it is ready. */
  problem?: (pipeline: Pipeline) => string | null
  /** Called with the pipeline as the page's settings change it. */
  onPipelineChange?: (pipeline: Pipeline) => void
}) {
  const [current, setCurrent] = useState(pipeline)
  useEffect(() => setCurrent(pipeline), [pipeline])
  useEffect(() => onPipelineChange?.(current), [current, onPipelineChange])
  const outputs = outputsOf(current)
  const outputId = outputs[0]?.id ?? 'output'
  const controller = useController(() =>
    createRunController({
      registry: productRegistry,
      surface,
      builtInTool,
      outputNodeId: outputId,
    }),
  )
  const state = useRunState(controller)
  useEffect(() => {
    void controller.setPipeline(current)
  }, [controller, current])
  // Files chosen on the open page for this tool arrive already added.
  useArrivingFiles({ path, onFiles: (files) => void controller.addFiles(files) })
  const count = state.sources.length

  if (outputs.length === 0) {
    return (
      <EmptyState
        title="This pipeline has no Output node"
        description="Add an Output node in the Studio to get files out of it."
        isCompact
      />
    )
  }
  return (
    <VStack gap={8}>
      <ToolColumns
        start={<FilesSection controller={controller} state={state} />}
        end={
          <ToolPanel
            step={2}
            title={adjustable.length > 0 ? 'Steps and settings' : 'Steps'}
            footer={
              <RunSection
                controller={controller}
                state={state}
                outputNodeId={outputId}
                surface={surface}
                countRun={countRun}
                blockedReason={problem?.(current) ?? null}
                runLabel={count > 0 ? `Run on ${count} image${count === 1 ? '' : 's'}` : 'Run'}
              />
            }
          >
            <VStack gap={4}>
              <PipelineSteps pipeline={current} registry={productRegistry} />
              <AdjustableSettings
                pipeline={current}
                nodeIds={adjustable}
                onChange={(nodeId, changes) =>
                  setCurrent((previous) => withSettings(previous, nodeId, changes))
                }
                isDisabled={state.running}
              />
            </VStack>
          </ToolPanel>
        }
      />
      <ResultsSection state={state} />
    </VStack>
  )
}

export function Missing({ title, description }: { title: string; description: string }) {
  return (
    <PageColumn>
      <EmptyState title={title} description={description} />
    </PageColumn>
  )
}

/** Why a pipeline cannot run in this version of Hexlode, or null when it can. */
export function pipelineProblem(pipeline: Pipeline) {
  try {
    validatePipeline(pipeline, productRegistry)
    return null
  } catch (reason) {
    return reason instanceof Error ? reason.message : 'This pipeline cannot run.'
  }
}

/** A pipeline saved in this browser, opened as a tool at `/tools/<id>`. */
export function PipelineToolPage({ pipelineId }: { pipelineId: string }) {
  usePageView({ page: 'pipeline-tool' })
  const navigate = useNavigate()
  const share = useSharePipeline()
  const store = pipelineStore()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const saved = useSyncExternalStore(
    store.subscribe,
    () => store.get(pipelineId),
    () => undefined,
  )
  if (!mounted) return null
  if (!saved) {
    return (
      <Missing
        title="Pipeline not found"
        description="It may have been deleted, or saved in another browser. Saved pipelines live in the browser that saved them."
      />
    )
  }
  const problem = pipelineProblem(saved.pipeline)
  if (problem) return <Missing title="This pipeline cannot run" description={problem} />
  return (
    <ToolPageFrame
      title={saved.name}
      eyebrow="Your tool"
      description={
        <HStack gap={3} vAlign="center" wrap="wrap">
          <Text type="large" color="secondary" weight="normal">
            A pipeline saved in this browser, ready for new images.
          </Text>
          <HStack gap={1} vAlign="center">
            <Button
              label="Edit in the Studio"
              size="sm"
              variant="ghost"
              onClick={() => void navigate({ to: '/studio', search: { pipeline: saved.id } })}
            />
            <Button label="Copy link" size="sm" variant="ghost" onClick={() => void share(saved)} />
          </HStack>
        </HStack>
      }
    >
      <PipelineToolBody
        path={`/tools/${saved.id}`}
        pipeline={saved.pipeline}
        countRun={() => pipelineStore().recordRun(saved.id)}
      />
    </ToolPageFrame>
  )
}

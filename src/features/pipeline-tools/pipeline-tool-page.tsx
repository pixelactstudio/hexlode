import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState, useSyncExternalStore } from 'react'

import { PageColumn } from '#/features/app-shell/page-column'
import { productRegistry } from '#/features/nodes/registry'
import { validatePipeline } from '#/features/pipelines/pipeline-file'
import { pipelineStore } from '#/features/pipelines/storage'
import type { SavedPipeline } from '#/features/pipelines/types'
import { ToolColumns, ToolPageFrame } from '#/features/quick-tools/quick-tool-page'
import { createRunController } from '#/features/runs/run-controller'
import { FilesSection, ResultsSection, RunSection, ToolPanel } from '#/features/runs/run-panel'
import { useController, useRunState } from '#/features/runs/use-run-controller'
import { PipelineSteps } from '#/features/studio/pipeline-steps'
import { usePageView } from '#/features/usage/use-page-view'

function outputsOf(pipeline: SavedPipeline) {
  return pipeline.pipeline.nodes.filter((node) => node.type === 'output')
}

function PipelineTool({ saved }: { saved: SavedPipeline }) {
  const outputs = outputsOf(saved)
  const outputId = outputs[0]?.id ?? 'output'
  const controller = useController(() =>
    createRunController({
      registry: productRegistry,
      surface: 'pipeline-tool',
      outputNodeId: outputId,
    }),
  )
  const state = useRunState(controller)
  useEffect(() => {
    void controller.setPipeline(saved.pipeline)
  }, [controller, saved])
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
            title="Steps"
            footer={
              <RunSection
                controller={controller}
                state={state}
                outputNodeId={outputId}
                surface="pipeline-tool"
                runLabel={count > 0 ? `Run on ${count} image${count === 1 ? '' : 's'}` : 'Run'}
              />
            }
          >
            <PipelineSteps pipeline={saved.pipeline} registry={productRegistry} />
          </ToolPanel>
        }
      />
      <ResultsSection state={state} />
    </VStack>
  )
}

function Missing({ title, description }: { title: string; description: string }) {
  return (
    <PageColumn>
      <EmptyState title={title} description={description} />
    </PageColumn>
  )
}

export function PipelineToolPage({ pipelineId }: { pipelineId: string }) {
  usePageView({ page: 'pipeline-tool' })
  const navigate = useNavigate()
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
  let problem: string | null = null
  try {
    validatePipeline(saved.pipeline, productRegistry)
  } catch (reason) {
    problem = reason instanceof Error ? reason.message : 'This pipeline cannot run.'
  }
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
          <Button
            label="Edit in the Studio"
            size="sm"
            variant="ghost"
            onClick={() => void navigate({ to: '/studio', search: { pipeline: saved.id } })}
          />
        </HStack>
      }
    >
      <PipelineTool saved={saved} />
    </ToolPageFrame>
  )
}

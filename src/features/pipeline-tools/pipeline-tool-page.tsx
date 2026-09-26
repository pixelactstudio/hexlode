import { Button } from '@astryxdesign/core/Button'
import { Center } from '@astryxdesign/core/Center'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { VStack } from '@astryxdesign/core/Stack'
import { Heading, Text } from '@astryxdesign/core/Text'
import { useNavigate } from '@tanstack/react-router'
import { Workflow } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'

import { usePageView } from '#/features/analytics/use-page-view'
import { AppFrame } from '#/features/app-shell/app-frame'
import { IconTile } from '#/features/app-shell/icon-tile'
import { productRegistry } from '#/features/nodes/registry'
import { validatePipeline } from '#/features/pipelines/pipeline-file'
import { pipelineStore } from '#/features/pipelines/storage'
import type { SavedPipeline } from '#/features/pipelines/types'
import { EngineGate } from '#/features/runs/engine-unavailable'
import { createRunController } from '#/features/runs/run-controller'
import { FilesCard, ResultsCard } from '#/features/runs/run-panel'
import { useController, useRunState } from '#/features/runs/use-run-controller'

function outputsOf(pipeline: SavedPipeline) {
  return pipeline.pipeline.nodes.filter((node) => node.type === 'output')
}

function PipelineTool({ saved }: { saved: SavedPipeline }) {
  const navigate = useNavigate()
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
  const nodeLabels = saved.pipeline.nodes
    .map((node) => productRegistry.get(node.type)?.label ?? node.type)
    .join(' → ')

  return (
    <VStack gap={8}>
      <VStack gap={3} hAlign="center">
        <IconTile icon={Workflow} tone="orange" size="lg" />
        <Heading level={1} justify="center">
          {saved.name}
        </Heading>
        <Text type="large" color="secondary" justify="center">
          {nodeLabels}
        </Text>
        <Button
          label="Edit in the Studio"
          onClick={() => void navigate({ to: '/studio', search: { pipeline: saved.id } })}
        />
      </VStack>
      {outputs.length === 0 ? (
        <EmptyState
          title="This pipeline has no Output node"
          description="Add an Output node in the Studio to get files out of it."
          isCompact
        />
      ) : (
        <>
          <FilesCard controller={controller} state={state} />
          <ResultsCard
            step={2}
            controller={controller}
            state={state}
            outputNodeId={outputId}
            surface="pipeline-tool"
            runLabel={`Run on ${state.sources.length} image${state.sources.length === 1 ? '' : 's'}`}
          />
        </>
      )}
    </VStack>
  )
}

export function PipelineToolPage({ pipelineId }: { pipelineId: string }) {
  usePageView({ page: 'pipeline-tool' })
  const store = pipelineStore()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const saved = useSyncExternalStore(
    store.subscribe,
    () => store.get(pipelineId),
    () => undefined,
  )
  let problem: string | null = null
  if (saved) {
    try {
      validatePipeline(saved.pipeline, productRegistry)
    } catch (reason) {
      problem = reason instanceof Error ? reason.message : 'This pipeline cannot run.'
    }
  }
  return (
    <AppFrame current="tool" contentPadding={0}>
      <Center axis="horizontal">
        <VStack width="100%" maxWidth={1080} paddingInline={6} paddingBlock={10}>
          {!mounted ? null : !saved ? (
            <Center height={400}>
              <EmptyState
                title="Pipeline not found"
                description="It may have been deleted, or saved in another browser. Saved pipelines live in the browser that saved them."
              />
            </Center>
          ) : problem ? (
            <Center height={400}>
              <EmptyState title="This pipeline cannot run" description={problem} />
            </Center>
          ) : (
            <EngineGate>
              <PipelineTool saved={saved} />
            </EngineGate>
          )}
        </VStack>
      </Center>
    </AppFrame>
  )
}

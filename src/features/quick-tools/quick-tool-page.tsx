import { Center } from '@astryxdesign/core/Center'
import { Grid } from '@astryxdesign/core/Grid'
import { VStack } from '@astryxdesign/core/Stack'
import { Heading, Text } from '@astryxdesign/core/Text'
import { useEffect, useState } from 'react'
import { track } from '#/features/analytics/analytics'
import { usePageView } from '#/features/analytics/use-page-view'
import { AppFrame } from '#/features/app-shell/app-frame'
import { IconTile } from '#/features/app-shell/icon-tile'
import { productRegistry } from '#/features/nodes/registry'
import { SettingsPanel } from '#/features/quick-tools/settings-panels'
import { QUICK_TOOL_UI } from '#/features/quick-tools/tool-ui'
import {
  OUTPUT_NODE_ID,
  QUICK_TOOL_DEFINITIONS,
  type QuickTool,
  type QuickToolSettings,
  quickToolPipeline,
} from '#/features/quick-tools/tools'
import { EngineGate } from '#/features/runs/engine-unavailable'
import { createRunController } from '#/features/runs/run-controller'
import { FilesCard, ResultsCard, StepCard } from '#/features/runs/run-panel'
import { useController, useRunState } from '#/features/runs/use-run-controller'

function QuickToolSteps<T extends QuickTool>({ tool }: { tool: T }) {
  const definition = QUICK_TOOL_DEFINITIONS[tool]
  const [settings, setSettings] = useState<QuickToolSettings[T]>(
    definition.defaults as QuickToolSettings[T],
  )
  const controller = useController(() =>
    createRunController({
      registry: productRegistry,
      surface: 'quick-tool',
      tool,
      outputNodeId: OUTPUT_NODE_ID,
    }),
  )
  const state = useRunState(controller)
  useEffect(() => {
    void controller.setPipeline(quickToolPipeline(tool, settings))
  }, [controller, tool, settings])
  const count = state.sources.length

  return (
    <VStack gap={6}>
      <Grid columns={{ minWidth: 340, max: 2 }} gap={6} align="stretch">
        <FilesCard controller={controller} state={state} />
        <StepCard step={2} title="Choose settings" description={QUICK_TOOL_UI[tool].settingsHint}>
          <SettingsPanel
            tool={tool}
            value={settings}
            onChange={setSettings}
            isDisabled={state.running}
          />
        </StepCard>
      </Grid>
      <ResultsCard
        controller={controller}
        state={state}
        outputNodeId={OUTPUT_NODE_ID}
        surface="quick-tool"
        runLabel={
          count > 0
            ? `${definition.title} ${count} image${count === 1 ? '' : 's'}`
            : definition.title
        }
      />
    </VStack>
  )
}

export function QuickToolPage<T extends QuickTool>({ tool }: { tool: T }) {
  const definition = QUICK_TOOL_DEFINITIONS[tool]
  const ui = QUICK_TOOL_UI[tool]
  usePageView({ page: 'quick-tool', tool })
  useEffect(() => track('quick_tool_opened', { tool }), [tool])

  return (
    <AppFrame current={tool} contentPadding={0}>
      <Center axis="horizontal">
        <VStack width="100%" maxWidth={1080} gap={8} paddingInline={6} paddingBlock={10}>
          <VStack gap={3} hAlign="center">
            <IconTile icon={ui.icon} tone={ui.tone} size="lg" />
            <Heading level={1} justify="center">
              {definition.title}
            </Heading>
            <Text type="large" color="secondary" justify="center">
              {definition.description}
            </Text>
          </VStack>
          <EngineGate>
            <QuickToolSteps tool={tool} />
          </EngineGate>
        </VStack>
      </Center>
    </AppFrame>
  )
}

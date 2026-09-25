import { Card } from '@astryxdesign/core/Card'
import { Grid } from '@astryxdesign/core/Grid'
import { VStack } from '@astryxdesign/core/Stack'
import { Heading, Text } from '@astryxdesign/core/Text'
import { useEffect, useState } from 'react'
import { track } from '#/features/analytics/analytics'
import { usePageView } from '#/features/analytics/use-page-view'
import { AppFrame } from '#/features/app-shell/app-frame'
import { productRegistry } from '#/features/nodes/registry'
import { SettingsPanel } from '#/features/quick-tools/settings-panels'
import {
  OUTPUT_NODE_ID,
  QUICK_TOOL_DEFINITIONS,
  type QuickTool,
  type QuickToolSettings,
  quickToolPipeline,
} from '#/features/quick-tools/tools'
import { createRunController } from '#/features/runs/run-controller'
import { FilesCard, ResultsCard } from '#/features/runs/run-panel'
import { useController, useRunState } from '#/features/runs/use-run-controller'

export function QuickToolPage<T extends QuickTool>({ tool }: { tool: T }) {
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
  usePageView({ page: 'quick-tool', tool })
  useEffect(() => track('quick_tool_opened', { tool }), [tool])
  useEffect(() => {
    void controller.setPipeline(quickToolPipeline(tool, settings))
  }, [controller, tool, settings])

  return (
    <AppFrame current={tool}>
      <VStack gap={6} maxWidth={1120}>
        <VStack gap={1}>
          <Heading level={1}>{definition.title}</Heading>
          <Text type="supporting">{definition.description}</Text>
        </VStack>
        <Grid columns={{ minWidth: 320, max: 2 }} gap={4} align="start">
          <Card>
            <VStack gap={4}>
              <Heading level={2}>Settings</Heading>
              <SettingsPanel
                tool={tool}
                value={settings}
                onChange={setSettings}
                isDisabled={state.running}
              />
            </VStack>
          </Card>
          <FilesCard controller={controller} state={state} />
        </Grid>
        <ResultsCard
          controller={controller}
          state={state}
          outputNodeId={OUTPUT_NODE_ID}
          surface="quick-tool"
          runLabel={`${definition.title} ${state.sources.length} image${state.sources.length === 1 ? '' : 's'}`}
        />
      </VStack>
    </AppFrame>
  )
}

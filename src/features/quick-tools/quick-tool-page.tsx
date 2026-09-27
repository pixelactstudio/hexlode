import { Icon } from '@astryxdesign/core/Icon'
import { VStack } from '@astryxdesign/core/Stack'
import { Heading, Text } from '@astryxdesign/core/Text'
import { motion } from 'motion/react'
import { type ReactNode, useEffect, useState } from 'react'

import { Eyebrow } from '#/features/app-shell/eyebrow'
import { PageColumn } from '#/features/app-shell/page-column'
import { productRegistry } from '#/features/nodes/registry'
import { SettingsPanel } from '#/features/quick-tools/settings-panels'
import { QUICK_TOOL_GROUPS, QUICK_TOOL_ICONS } from '#/features/quick-tools/tool-ui'
import {
  OUTPUT_NODE_ID,
  QUICK_TOOL_DEFINITIONS,
  type QuickTool,
  type QuickToolSettings,
  quickToolPipeline,
} from '#/features/quick-tools/tools'
import { EngineGate } from '#/features/runs/engine-unavailable'
import { createRunController } from '#/features/runs/run-controller'
import { FilesSection, ResultsSection, RunSection, ToolPanel } from '#/features/runs/run-panel'
import { useController, useRunState } from '#/features/runs/use-run-controller'
import { track } from '#/features/usage/usage'
import { usePageView } from '#/features/usage/use-page-view'
import { formatCount } from '#/lib/format'
import { RouterLink } from '#/lib/router-link'

const TOOLS = QUICK_TOOL_GROUPS.flatMap((group) => group.tools)

/** Every quick tool in one row, so switching tools is one click. The current one is marked. */
function ToolTabs({ current }: { current: QuickTool }) {
  return (
    <nav aria-label="Quick tools" className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
      <span className="flex min-w-max overflow-hidden rounded-lg border border-border sm:grid sm:min-w-0 sm:grid-cols-6">
        {TOOLS.map((tool, index) => {
          const isCurrent = tool === current
          return (
            <RouterLink
              key={tool}
              href={QUICK_TOOL_DEFINITIONS[tool].path}
              aria-current={isCurrent ? 'page' : undefined}
              className={`relative flex items-center justify-center gap-2 px-4 py-3 font-medium text-sm no-underline outline-accent transition-colors focus-visible:outline-2 ${
                index > 0 ? 'border-border border-l' : ''
              } ${isCurrent ? 'text-primary' : 'text-secondary hover:bg-overlay-hover hover:text-primary'}`}
            >
              {isCurrent ? (
                <motion.span
                  layoutId="tool-tab"
                  className="absolute inset-0 bg-muted"
                  transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                />
              ) : null}
              <span className="relative inline-flex items-center gap-2">
                <Icon icon={QUICK_TOOL_ICONS[tool]} size="sm" color="inherit" />
                {QUICK_TOOL_DEFINITIONS[tool].title}
              </span>
              {isCurrent ? (
                <motion.span
                  layoutId="tool-tab-line"
                  className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-red-vivid"
                  transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                />
              ) : null}
            </RouterLink>
          )
        })}
      </span>
    </nav>
  )
}

/**
 * The frame every tool page shares: an optional row above the title, the name and one line, then
 * the tool. Quick tools and pipeline tools both use it.
 */
export function ToolPageFrame({
  eyebrow,
  title,
  description,
  above,
  children,
}: {
  eyebrow?: string
  title: string
  description: ReactNode
  /** Shown above the title, such as the row of quick tools. */
  above?: ReactNode
  children: ReactNode
}) {
  return (
    <PageColumn gap={8} paddingBlock={10}>
      {above}
      <VStack gap={3}>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <Heading level={1} type="display-2">
          {title}
        </Heading>
        {typeof description === 'string' ? (
          <Text type="large" color="secondary" weight="normal">
            {description}
          </Text>
        ) : (
          description
        )}
      </VStack>
      <EngineGate>{children}</EngineGate>
    </PageColumn>
  )
}

/**
 * Images on the left, settings and the run button on the right, both panels the same height so
 * neither leaves a gap below it; stacked on narrow screens.
 */
export function ToolColumns({ start, end }: { start: ReactNode; end: ReactNode }) {
  return (
    <span className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      {start}
      {end}
    </span>
  )
}

function runLabel(tool: QuickTool, count: number) {
  const images = count === 1 ? '1 image' : `${formatCount(count)} images`
  if (tool === 'strip-metadata')
    return count > 0 ? `Strip metadata from ${images}` : 'Strip metadata'
  const verb = QUICK_TOOL_DEFINITIONS[tool].title
  return count > 0 ? `${verb} ${images}` : verb
}

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

  return (
    <VStack gap={8}>
      <ToolColumns
        start={<FilesSection controller={controller} state={state} />}
        end={
          <ToolPanel
            step={2}
            title="Settings"
            footer={
              <RunSection
                controller={controller}
                state={state}
                outputNodeId={OUTPUT_NODE_ID}
                surface="quick-tool"
                runLabel={runLabel(tool, state.sources.length)}
              />
            }
          >
            <SettingsPanel
              tool={tool}
              value={settings}
              onChange={setSettings}
              isDisabled={state.running}
            />
          </ToolPanel>
        }
      />
      <ResultsSection state={state} />
    </VStack>
  )
}

export function QuickToolPage<T extends QuickTool>({ tool }: { tool: T }) {
  const definition = QUICK_TOOL_DEFINITIONS[tool]
  const group = QUICK_TOOL_GROUPS.find((entry) => entry.tools.includes(tool))
  usePageView({ page: 'quick-tool', tool })
  useEffect(() => track('quick_tool_opened', { tool }), [tool])

  return (
    <ToolPageFrame
      eyebrow={group?.label}
      title={definition.title}
      description={definition.description}
      above={<ToolTabs current={tool} />}
    >
      <QuickToolSteps key={tool} tool={tool} />
    </ToolPageFrame>
  )
}

import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Icon } from '@astryxdesign/core/Icon'
import { ProgressBar } from '@astryxdesign/core/ProgressBar'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Heading, Text } from '@astryxdesign/core/Text'
import { Download } from 'lucide-react'
import type { ReactNode } from 'react'

import { describeEstimate } from '#/features/engine/estimate'
import { FileDrop } from '#/features/runs/file-drop'
import { ResultsTable, resultRows } from '#/features/runs/results-table'
import {
  downloadDelivery,
  type RunController,
  type RunControllerState,
} from '#/features/runs/run-controller'
import { SourceList } from '#/features/runs/source-list'
import { formatBytes, formatCount, formatDuration } from '#/lib/format'

function plural(count: number, noun: string) {
  return `${formatCount(count)} ${noun}${count === 1 ? '' : 's'}`
}

/** The number of a step on a tool page, so the eye reads the panels in order. */
function StepNumber({ step }: { step: number }) {
  return (
    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-muted font-semibold text-primary text-xs tabular-nums">
      {step}
    </span>
  )
}

/**
 * A numbered panel of a tool page: a header with the step and its name, the body, and an optional
 * footer for the actions. It fills the height of its row, keeping the footer at the bottom.
 */
export function ToolPanel({
  step,
  title,
  end,
  children,
  footer,
}: {
  step: number
  title: string
  end?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Card padding={0} height="100%">
      <span className="flex h-full flex-col">
        <span className="block border-border border-b">
          <HStack gap={3} vAlign="center" hAlign="between" paddingInline={5} paddingBlock={4}>
            <HStack gap={3} vAlign="center">
              <StepNumber step={step} />
              <Heading level={2}>{title}</Heading>
            </HStack>
            {end}
          </HStack>
        </span>
        <span className="flex flex-1 flex-col gap-5 p-5">{children}</span>
        {footer ? (
          <span className="block border-border border-t">
            <VStack gap={4} padding={5}>
              {footer}
            </VStack>
          </span>
        ) : null}
      </span>
    </Card>
  )
}

/** The drop area and the list of added images, as the first panel of a tool page. */
export function FilesSection({
  controller,
  state,
}: {
  controller: RunController
  state: RunControllerState
}) {
  const count = state.sources.length
  return (
    <ToolPanel
      step={1}
      title="Add images"
      end={
        count > 0 ? (
          <Text type="supporting" hasTabularNumbers>
            {plural(count, 'image')}
          </Text>
        ) : undefined
      }
    >
      <FileDrop
        onFiles={(files) => void controller.addFiles(files)}
        isDisabled={state.running}
        size={count > 0 ? 'md' : 'fill'}
      />
      <SourceList controller={controller} state={state} />
    </ToolPanel>
  )
}

/** Status, run button, progress and download for a pipeline with one Output node. */
export function RunSection({
  controller,
  state,
  outputNodeId,
  runLabel,
  surface,
}: {
  controller: RunController
  state: RunControllerState
  outputNodeId: string
  runLabel: string
  surface: 'quick-tool' | 'pipeline-tool'
}) {
  const { stats, sources, running } = state
  const delivery = stats.deliveries[outputNodeId]
  const canRun = sources.length > 0 && !running && !state.preparing
  const count = sources.length
  const done = stats.status !== 'idle' && stats.status !== 'running'
  const delivered = delivery?.files.length ?? 0
  const totalIn = sources.reduce((sum, source) => sum + (source.meta.size ?? 0), 0)

  const status = running
    ? `Working on ${formatCount(Math.min(count, stats.finishedItems + 1))} of ${formatCount(count)}…`
    : done && stats.status === 'complete'
      ? `${formatCount(delivered)} of ${plural(count, 'image')} done in ${formatDuration(stats.ms)}. ${formatBytes(totalIn)} became ${formatBytes(delivery?.bytes ?? 0)}.`
      : done && stats.status === 'cancelled'
        ? 'Cancelled. The images that finished can still be downloaded.'
        : count === 0
          ? 'Add images to start.'
          : state.estimate
            ? `${plural(count, 'image')} ready · ${describeEstimate(state.estimate)}`
            : `${plural(count, 'image')} ready`

  const run = async () => {
    await controller.start({ singleFileAsIs: true })
  }

  return (
    <VStack gap={3}>
      {state.error ? (
        <Banner status="error" title="The run stopped" description={state.error} />
      ) : null}
      {running ? (
        <ProgressBar
          label="Progress"
          isLabelHidden
          value={stats.finishedItems}
          max={Math.max(1, count)}
        />
      ) : null}
      <Text type="supporting" hasTabularNumbers>
        {status}
      </Text>
      {running ? (
        <Button
          label="Cancel"
          variant="secondary"
          width="100%"
          onClick={() => controller.cancel()}
        />
      ) : delivery?.archive ? (
        <HStack gap={2}>
          <span className="min-w-0 flex-1">
            <Button
              label={
                delivery.files.length === 1
                  ? 'Download'
                  : `Download ZIP of ${formatCount(delivery.files.length)}`
              }
              variant="primary"
              size="lg"
              width="100%"
              icon={<Icon icon={Download} size="sm" />}
              onClick={() => downloadDelivery(delivery, surface)}
            />
          </span>
          <Button
            label="Run again"
            variant="secondary"
            size="lg"
            isDisabled={!canRun}
            clickAction={run}
          />
        </HStack>
      ) : (
        <Button
          label={runLabel}
          variant="primary"
          size="lg"
          width="100%"
          isDisabled={!canRun}
          isLoading={running}
          clickAction={run}
        />
      )}
    </VStack>
  )
}

/** Before and after sizes for every image, once a run has started. */
export function ResultsSection({ state }: { state: RunControllerState }) {
  const rows = resultRows(state)
  if (state.stats.status === 'idle' || rows.length === 0) return null
  return (
    <VStack gap={3}>
      <Heading level={2}>Results</Heading>
      <ResultsTable rows={rows} />
    </VStack>
  )
}
